/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from './config.js';
import { handleFirestoreError, OperationType } from './errors.js';
import type { Campanha, CanalAtendimento } from '@/src/types';

/**
 * Cria uma nova campanha de marketing ativo
 */
export async function criarCampanha(dados: {
  nome: string;
  mensagem: string;
  agendadoPara: Date | null;
  filtros: {
    tags?: string[];
    origem?: string;
    setorId?: string;
    canal?: CanalAtendimento;
  };
}) {
  const path = 'campanhas';
  try {
    // 1. Calcular total de alvos baseado nos filtros (simulação rápida)
    const totalAlvos = await contarAlvosSegmentados(dados.filtros);

    const docRef = await addDoc(collection(db, path), {
      ...dados,
      status: dados.agendadoPara ? 'agendada' : 'rascunho',
      totalAlvos,
      enviados: 0,
      erros: 0,
      criadoEm: serverTimestamp(),
      agendadoPara: dados.agendadoPara ? Timestamp.fromDate(dados.agendadoPara) : null
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Conta quantos leads batem com os filtros da campanha
 */
async function contarAlvosSegmentados(filtros: any): Promise<number> {
  // Em uma estrutura real, faríamos consultas complexas. 
  // Aqui vamos simular buscando os chats que batem com os critérios.
  let q = query(collection(db, 'chats'));
  
  if (filtros.canal) {
    q = query(q, where('canal', '==', filtros.canal));
  }
  if (filtros.setorId) {
    q = query(q, where('setorId', '==', filtros.setorId));
  }
  
  const snap = await getDocs(q);
  // Filtro de tags via JS (Firestore não suporta múltiplos array-contains de forma simples sem índices pesados)
  let count = 0;
  snap.forEach(doc => {
    const data = doc.data();
    let match = true;
    if (filtros.tags && filtros.tags.length > 0) {
      match = filtros.tags.every((t: string) => (data.tags || []).includes(t));
    }
    if (match) count++;
  });

  return count;
}

/**
 * Escuta todas as campanhas em tempo real
 */
export function escutarCampanhas(callback: (campanhas: Campanha[]) => void) {
  const q = query(collection(db, 'campanhas'), orderBy('criadoEm', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const campanhas = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        criadoEm: data.criadoEm?.toDate() || new Date(),
        agendadoPara: data.agendadoPara?.toDate() || null
      };
    }) as Campanha[];
    callback(campanhas);
  });
}

/**
 * Atualiza o status de uma campanha
 */
export async function atualizarStatusCampanha(id: string, status: Campanha['status']) {
  try {
    await updateDoc(doc(db, 'campanhas', id), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campanhas/${id}`);
  }
}
