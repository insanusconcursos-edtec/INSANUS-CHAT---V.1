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
  serverTimestamp,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db } from './config.js';
import { handleFirestoreError, OperationType } from './errors.js';
import { onSnapshotWithRetry } from './listeners.js';
import type { Lembrete, PrioridadeLembrete, AntecedenciaLembrete } from '@/src/types';

/**
 * Cria um novo lembrete associado a um chat e atendente
 */
export async function criarLembrete(dados: {
  chatId: string;
  atendenteId: string;
  clienteNome: string;
  descricao: string;
  dataHora: Date;
  prioridade: PrioridadeLembrete;
  configuracaoAntecedencia: AntecedenciaLembrete;
}) {
  const path = 'lembretes';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...dados,
      status: 'pendente',
      createdAt: serverTimestamp(),
      dataHora: Timestamp.fromDate(dados.dataHora)
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Marca um lembrete como concluído
 */
export async function concluirLembrete(lembreteId: string) {
  const path = `lembretes/${lembreteId}`;
  try {
    await updateDoc(doc(db, 'lembretes', lembreteId), {
      status: 'concluido',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Escuta lembretes ativos (pendentes) que devem ser acionados agora
 */
export function escutarLembretesAtivos(atendenteId: string, callback: (lembretes: Lembrete[]) => void) {
  const path = 'lembretes';
  const agora = new Date();
  
  const q = query(
    collection(db, path),
    where('atendenteId', '==', atendenteId),
    where('status', '==', 'pendente'),
    where('dataHora', '<=', Timestamp.fromDate(agora)),
    orderBy('dataHora', 'desc')
  );

  return onSnapshotWithRetry(q, (snapshot) => {
    const lembretes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        dataHora: (data.dataHora as Timestamp).toDate()
      };
    }) as Lembrete[];
    callback(lembretes);
  }, path);
}

/**
 * Escuta a agenda completa do dia para o atendente
 */
export function escutarAgendaDia(atendenteId: string, callback: (lembretes: Lembrete[]) => void) {
  const path = 'lembretes';
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  
  const fimDia = new Date();
  fimDia.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, path),
    where('atendenteId', '==', atendenteId),
    where('dataHora', '>=', Timestamp.fromDate(inicioDia)),
    where('dataHora', '<=', Timestamp.fromDate(fimDia)),
    orderBy('dataHora', 'asc')
  );

  return onSnapshotWithRetry(q, (snapshot) => {
    const lembretes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        dataHora: (data.dataHora as Timestamp).toDate()
      };
    }) as Lembrete[];
    callback(lembretes);
  }, path);
}
