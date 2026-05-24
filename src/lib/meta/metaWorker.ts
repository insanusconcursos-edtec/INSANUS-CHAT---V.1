/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { enviarMensagemPeloCanal } from './metaApiService.js';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Worker que monitora mensagens de saída (Agente ou IA) e despacha via API da Meta
 */
export function iniciarMonitoramentoSaidaMeta() {
  console.log("[Meta Worker] Iniciando monitoramento de mensagens de saída...");

  // Monitorar a coleção de mensagens em todos os chats (ou mensagens globais se tivéssemos)
  // Como as mensagens estão em subcoleções, uma abordagem melhor no Firestore é usar um Group Query 
  // ou monitorar os próprios chats que mudaram. 
  
  // Para fins deste MVP e limitações do ambiente (sem functions), vamos monitorar chats 
  // que tiveram a última mensagem enviada por agende/ia.
  
  const q = query(
    collection(db, 'chats'),
    where('semRespostaDesde', '==', null), // Indica que o último a falar foi atendente ou IA
    limit(20)
  );

  return onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'modified') {
        const chatData = change.doc.data();
        const chatId = change.doc.id;

        // Se o canal for WhatsApp ou Instagram e o atendente respondeu agora
        if (['whatsapp', 'instagram'].includes(chatData.canal)) {
          await processarUltimaMensagemSaida(chatId, chatData);
        }
      }
    }
  });
}

async function processarUltimaMensagemSaida(chatId: string, chatData: any) {
  try {
    // Buscar a mensagem mais recente desse chat
    const { getDocs, query, collection, orderBy, limit } = await import('firebase/firestore');
    const msgQ = query(
      collection(db, 'chats', chatId, 'mensagens'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const msgSnap = await getDocs(msgQ);
    if (!msgSnap.empty) {
      const msg = msgSnap.docs[0].data();
      
      // Se for do agente ou IA e ainda não foi processada pelo worker (precisamos de um flag para evitar loop)
      if ((msg.remetente === 'agente' || msg.remetente === 'ia') && !msg.metaMessageId) {
        console.log(`[Meta Worker] Despachando resposta via API para Chat ${chatId}...`);
        
        const result = await enviarMensagemPeloCanal(
           chatData.clienteTelefone, 
           msg.texto, 
           chatData.canal,
           chatData.origemId
        );

        if (result && (result.messages?.[0]?.id || result.message_id)) {
           // Marcar mensagem como enviada na Meta para evitar re-processamento
           const { updateDoc, doc } = await import('firebase/firestore');
           await updateDoc(msgSnap.docs[0].ref, {
             metaMessageId: result.messages?.[0]?.id || result.message_id,
             sentAt: new Date()
           });
           console.log(`[Meta Worker] Mensagem enviada com sucesso ID: ${result.messages?.[0]?.id}`);
        }
      }
    }
  } catch (error) {
    console.error("[Meta Worker Error]:", error);
  }
}
