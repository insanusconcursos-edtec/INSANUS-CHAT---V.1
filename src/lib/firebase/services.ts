/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  setDoc,
  serverTimestamp, 
  getDoc,
  getDocFromServer,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from './config.js';
import { handleFirestoreError, OperationType } from './errors.js';
import type { Chat, Mensagem, EtapaFunil, CanalAtendimento, RemetenteMensagem } from '@/src/types';

/**
 * Valida a conexão inicial com o Firestore e semeia dados se necessário
 */
export async function testarConexao() {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("Conexão com Firestore estabelecida com sucesso.");
    
    // Semear setores iniciais
    await semearSetores();
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase está offline. Verifique a configuração.");
    }
  }
}

/**
 * Cria os setores iniciais caso não existam
 */
async function semearSetores() {
  const setores = [
    { id: 'comercial-id', nome: 'Comercial' },
    { id: 'financeiro-id', nome: 'Financeiro' },
    { id: 'pedagogico-id', nome: 'Suporte Pedagógico' },
    { id: 'triagem-id', nome: 'Triagem Geral' }
  ];

  for (const setor of setores) {
    try {
      await setDoc(doc(db, 'setores', setor.id), {
        nome: setor.nome,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error(`Erro ao semear setor ${setor.nome}:`, e);
    }
  }
}

/**
 * Cria um novo chat na coleção /chats
 */
export async function criarNovoChat(dados: {
  clienteNome: string;
  clienteTelefone: string;
  clienteFoto?: string;
  canal: CanalAtendimento;
  setorId: string;
  origem: string;
  origemId?: string;
}) {
  const path = 'chats';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...dados,
      statusEtapa: 'novo',
      atendenteId: null,
      dataUltimaMensagem: serverTimestamp(),
      semRespostaDesde: serverTimestamp(),
      tags: [],
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Confirma o início do atendimento pelo vendedor (Distribuído via Round-Robin)
 */
export async function confirmarAtendimento(chatId: string) {
  const path = `chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      status: 'em_atendimento',
      confirmedAt: serverTimestamp(),
      responsabilidade: 'humano',
      avisoFailover: null
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Atribui um atendente a um chat específico
 */
export async function atribuirAtendente(chatId: string, atendenteId: string) {
  const path = `chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      atendenteId,
      status: 'em_atendimento', // Ao assumir manualmente, já entra em atendimento
      responsabilidade: atendenteId ? 'humano' : 'ia',
      avisoFailover: null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Altera a etapa do funil de vendas de um chat
 */
export async function alterarEtapaFunil(chatId: string, novaEtapa: EtapaFunil) {
  const path = `chats/${chatId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      statusEtapa: novaEtapa,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Busca um chat ativo pelo identificador do cliente (telefone ou ID externo)
 */
export async function buscarChatPorContato(contato: string, canal: CanalAtendimento) {
  try {
    const q = query(
      collection(db, 'chats'),
      where('clienteTelefone', '==', contato),
      where('canal', '==', canal),
      limit(10)
    );

    // Timeout de 5 segundos para evitar hang infinito
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Firestore query timeout")), 5000)
    );

    const snap = await Promise.race([
      getDocs(q),
      timeoutPromise
    ]) as any;

    if (snap && !snap.empty) {
      const chatsAtivos = snap.docs
        .map((d: any) => ({ id: d.id, ...d.data() } as Chat))
        .filter((c: Chat) => c.statusEtapa !== 'fechado');
      
      return chatsAtivos.length > 0 ? chatsAtivos[0] : null;
    }
    return null;
  } catch (error) {
    console.error("[Firebase Service] Erro em buscarChatPorContato:", error);
    return null;
  }
}

/**
 * Salva uma nova mensagem vinculada a um chat
 */
export async function salvarMensagem(chatId: string, remetente: RemetenteMensagem, texto: string) {
  const path = `chats/${chatId}/mensagens`;
  try {
    // 1. Salva a mensagem na subcoleção
    await addDoc(collection(db, 'chats', chatId, 'mensagens'), {
      chatId,
      remetente,
      texto,
      timestamp: serverTimestamp(),
    });

    // 2. Atualiza o timestamp da última mensagem no chat pai
    await updateDoc(doc(db, 'chats', chatId), {
      dataUltimaMensagem: serverTimestamp(),
      // Se for mensagem do cliente, marca que está aguardando resposta e reseta status da IA
      ...(remetente === 'cliente' 
          ? { semRespostaDesde: serverTimestamp(), iaStatus: 'pendente' } 
          : { semRespostaDesde: null }
      )
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
