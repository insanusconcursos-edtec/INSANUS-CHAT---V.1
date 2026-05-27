/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from './config.js';
import { handleFirestoreError, OperationType } from './errors.js';
import { SYSTEM_PROMPT_VENDAS } from './iaPromptVendas.js';
import type { Mensagem } from '@/src/types';

/**
 * Gera uma resposta humanizada do Agente de Vendas Virtual.
 */
export async function gerarRespostaVendedorVirtual(chatId: string, historico: Mensagem[]) {
  try {
    const chatRef = doc(db, 'chats', chatId);

    const ultimaMensagem = historico[historico.length - 1]?.texto || "";

    // 2. Chama o backend para gerar a resposta com o Gemini
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId, // Passamos o chatId para o backend validar idempotência
        texto: ultimaMensagem,
        historico: historico.slice(-5), // Envia apenas as últimas 5 para contexto
        sistemaPrompt: SYSTEM_PROMPT_VENDAS
      })
    });

    if (!response.ok) throw new Error('Falha no motor de IA de vendas');

    const { resposta } = await response.json();

    // 3. Atualiza metadados do chat (A mensagem já foi salva pelo próprio endpoint /api/chat)
    await updateDoc(chatRef, {
      statusEtapa: 'negociacao', // IA assume que iniciou a negociação
      updatedAt: serverTimestamp()
    });

    console.log(`[IA Sales] Resposta gerada via API p/ chat ${chatId}`);
    return resposta;

  } catch (error) {
    // Em caso de erro, limpa o status para não travar o painel
    await updateDoc(doc(db, 'chats', chatId), { iaStatus: 'erro' }).catch(() => {});
    handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/mensagens (IA Agent)`);
  }
}
