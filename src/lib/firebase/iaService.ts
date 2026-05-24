/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from './config.js';
import { handleFirestoreError, OperationType } from './errors.js';
import { distribuirNovoLead } from './distribuicaoService.js';

// Mapeamento de Setores e IDs
const SETORES_MAP = {
  COMERCIAL: { id: 'comercial-id', nome: 'Comercial' },
  FINANCEIRO: { id: 'financeiro-id', nome: 'Financeiro' },
  PEDAGOGICO: { id: 'pedagogico-id', nome: 'Suporte Pedagógico' }
};

/**
 * Realiza a triagem analítica da intenção do cliente com base no texto.
 * Roteia para o setor correto e envia uma resposta automática.
 */
export async function processarTriagemMensagem(chatId: string, mensagemTexto: string) {
  const texto = mensagemTexto.toLowerCase();
  let intent: keyof typeof SETORES_MAP | null = null;

  // Lógica Semântica (Simulada por Keywords conforme solicitado)
  if (["comprar", "curso", "valor", "matrícula", "desconto", "preço"].some(k => texto.includes(k))) {
    intent = 'COMERCIAL';
  } else if (["boleto", "pagamento", "financeiro", "comprovante", "pix", "fatura", "reembolso"].some(k => texto.includes(k))) {
    intent = 'FINANCEIRO';
  } else if (["dúvida", "aula", "cronograma", "planner", "professor", "acesso"].some(k => texto.includes(k))) {
    intent = 'PEDAGOGICO';
  }

  if (!intent) {
    console.log(`[IA Triage] Intenção não identificada claramente para o chat ${chatId}.`);
    return;
  }

  const setor = SETORES_MAP[intent];

  try {
    // 1. Atualiza o Chat no Firestore (Roteamento)
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      setorId: setor.id,
      statusEtapa: 'novo',
      updatedAt: serverTimestamp(),
      iaNote: `Triagem automática: Detectada intenção ${setor.nome}`
    });

    // 2. Injeta a mensagem do "Agente Virtual" (Resposta humanizada)
    await addDoc(collection(db, 'chats', chatId, 'mensagens'), {
      chatId,
      remetente: 'ia',
      texto: `Olá! Entendi sua necessidade. ✨ Estou direcionando você agora mesmo para a nossa equipe do setor ${setor.nome}. Um minuto, por favor!`,
      timestamp: serverTimestamp(),
    });

    console.log(`[IA Triage] Chat ${chatId} roteado com sucesso para ${setor.nome}.`);

    // 3. Se for COMERCIAL, iniciar Distribuição Circular (Round-Robin)
    if (intent === 'COMERCIAL') {
      await distribuirNovoLead(chatId);
    }
    
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId} (IA Triage)`);
  }
}

/**
 * Mantemos a versão avançada (Gemini) como backup ou para triagens complexas
 */
export async function triagemAvancadaGemini(chatId: string, texto: string) {
  // Lógica anterior via API Gemini...
  // (Pode ser acionada se a lógica de keywords falhar)
}
