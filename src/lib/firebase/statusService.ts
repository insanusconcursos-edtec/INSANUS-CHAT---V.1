/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config.js';

/**
 * Atualiza o status de disponibilidade do usuário
 */
export async function atualizarStatusUsuario(uid: string, status: 'online' | 'offline' | 'ocupado') {
  if (!uid) return;
  
  const userRef = doc(db, 'usuarios', uid);
  try {
    await updateDoc(userRef, {
      status,
      ultimaAtividade: serverTimestamp()
    });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
  }
}
