/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, query, where, onSnapshot, limit, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './config.js';
import { processarTriagemMensagem, triagemAvancadaGemini } from './iaService.js';
import { gerarRespostaVendedorVirtual } from './iaAgenteVendasService.js';
import { onSnapshotWithRetry } from './listeners.js';

/**
 * Worker que monitora novos chats e executa a triagem automática.
 */
export function iniciarMonitoramentoTriagem() {
  console.log("[IA Worker] Monitorando chats para triagem e atendimento...");
  
  // Monitoramos chats que estão no fluxo da IA: 
  // 1. Etapa 'novo' + Triagem (para roteamento)
  // 2. Chats atribuídos à IA (atendenteId === null) para resposta automática
  const q = query(
    collection(db, 'chats'),
    where('statusEtapa', 'in', ['novo', 'negociacao']),
    limit(20)
  );

  // Iniciar rotina de verificação de tempo limite para confirmação (Failover para IA)
  iniciarRotinaFailoverIA();

  return onSnapshotWithRetry(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const chatData = change.doc.data();
      const chatId = change.doc.id;

      // Lógica 1: Triagem de novos chats
      if (chatData.setorId === 'triagem-id' && chatData.statusEtapa === 'novo') {
        monitorarMensagensParaTriagem(chatId);
      }

      // Lógica 2: Resposta do Vendedor Virtual (se atribuído à IA ou em failover)
      if ((chatData.atendenteId === null || chatData.responsabilidade === 'ia') && chatData.semRespostaDesde) {
        processarRespostaIA(chatId);
      }
    });
  }, 'chats_worker');
}

/**
 * Verifica periodicamente chats aguardando confirmação humana
 */
function iniciarRotinaFailoverIA() {
  setInterval(async () => {
    const agora = Date.now();
    const q = query(
      collection(db, 'chats'),
      where('status', '==', 'aguardando_confirmacao'),
      where('responsabilidade', '==', 'humano')
    );

    try {
      const snap = await getDocs(q);
      snap.forEach(async (d) => {
        const chat = d.data();
        const distribuidoEm = chat.distribuidoEm?.toDate()?.getTime() || 0;
        const segundosPassados = (agora - distribuidoEm) / 1000;

        if (segundosPassados > 60) {
          console.log(`[IA Worker] Failover: Chat ${d.id} excedeu 1 min sem confirmação. IA assumindo.`);
          await updateDoc(doc(db, 'chats', d.id), {
            responsabilidade: 'ia',
            atendenteId: null, // IA assume
            avisoFailover: 'IA assumiu por tempo limite. Clique em ASSUMIR CONVERSA para retomar.'
          });
          
          // Disparar resposta imediata da IA
          await processarRespostaIA(d.id);
        }
      });
    } catch (err) {
      console.error('[IA Worker] Erro na rotina de failover:', err);
    }
  }, 15000); // Verifica a cada 15 seg
}

function monitorarMensagensParaTriagem(chatId: string) {
  const q = query(
    collection(db, 'chats', chatId, 'mensagens'),
    where('remetente', '==', 'cliente'),
    orderBy('timestamp', 'asc'),
    limit(1)
  );

  const unsubscribe = onSnapshotWithRetry(q, (snapshot) => {
    if (!snapshot.empty) {
      const firstMsg = snapshot.docs[0].data();
      console.log(`[IA Worker] Analisando mensagem para triagem no chat ${chatId}`);
      processarTriagemMensagem(chatId, firstMsg.texto);
      unsubscribe();
    }
  }, `triagem_${chatId}`);
}

async function processarRespostaIA(chatId: string) {
  console.log(`[IA Worker] Agente Virtual preparando resposta para chat ${chatId}...`);
  
  // Buscar histórico para contexto
  const q = query(
    collection(db, 'chats', chatId, 'mensagens'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );

  const snap = await getDocs(q);
  const historico = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse() as any[];

  // Só responde se a última mensagem for do cliente
  const ultimaMsg = historico[historico.length - 1];
  if (ultimaMsg && ultimaMsg.remetente === 'cliente') {
    await gerarRespostaVendedorVirtual(chatId, historico);
  }
}
