/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  limit,
  where,
  or,
  and,
  Query,
  QuerySnapshot
} from 'firebase/firestore';
import { db } from './config.js';
import { handleFirestoreError, OperationType } from './errors.js';
import type { Mensagem, Chat, Usuario } from '@/src/types';

/**
 * Utilitário para onSnapshot com re-tentativa em caso de erro de conexão (Code 13)
 */
export function onSnapshotWithRetry(
  q: Query, 
  onNext: (snapshot: QuerySnapshot) => void, 
  path: string,
  retryCount = 0
) {
  const unsubscribe = onSnapshot(q, onNext, (error) => {
    // Code 13: INTERNAL / Connection error
    if (error.code === 'internal' && retryCount < 3) {
      console.warn(`[Firestore] Erro de conexão (13) em ${path}. Tentando reconectar em 2s...`, error);
      unsubscribe(); // Limpa o atual
      setTimeout(() => {
        onSnapshotWithRetry(q, onNext, path, retryCount + 1);
      }, 2000);
    } else {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  });

  return unsubscribe;
}

/**
 * Escuta mensagens em tempo real de um chat específico
 */
export function escutarMensagensChat(chatId: string, callback: (mensagens: Mensagem[]) => void) {
  const path = `chats/${chatId}/mensagens`;
  const q = query(
    collection(db, 'chats', chatId, 'mensagens'),
    orderBy('timestamp', 'asc')
  );

  return onSnapshotWithRetry(q, (snapshot) => {
    const mensagens = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Mensagem[];
    callback(mensagens);
  }, path);
}

/**
 * Escuta chats ativos com lógica de carteirização (RBAC)
 */
export function escutarChatsCarteira(usuario: Usuario, callback: (chats: Chat[]) => void) {
  const path = 'chats';
  let q;

  if (usuario.papel === 'admin') {
    // Admin vê tudo
    q = query(
      collection(db, 'chats'), 
      orderBy('dataUltimaMensagem', 'desc')
    );
  } else {
    // Agente vê o que é dele OU o que está sem dono no setor dele
    q = query(
      collection(db, 'chats'),
      or(
        where('atendenteId', '==', usuario.id),
        and(
          where('atendenteId', '==', null),
          where('setorId', '==', usuario.setorId)
        )
      ),
      orderBy('dataUltimaMensagem', 'desc')
    );
  }

  return onSnapshotWithRetry(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Chat[];
    callback(chats);
  }, path);
}

/**
 * Escuta chats ativos de um setor ou atendente em tempo real (Geral)
 */
export function escutarChatsAtivos(filtros: { setorId?: string; atendenteId?: string }, callback: (chats: Chat[]) => void) {
  const path = 'chats';
  let q = query(collection(db, 'chats'), orderBy('dataUltimaMensagem', 'desc'));

  if (filtros.setorId) {
    q = query(q, where('setorId', '==', filtros.setorId));
  }
  if (filtros.atendenteId) {
    q = query(q, where('atendenteId', '==', filtros.atendenteId));
  }

  return onSnapshotWithRetry(q, (snapshot) => {
    const chats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Chat[];
    callback(chats);
  }, path);
}
