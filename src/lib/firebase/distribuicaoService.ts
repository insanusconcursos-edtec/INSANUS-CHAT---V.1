/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';

/**
 * Distribui um novo lead seguindo a lógica de Fila Circular (Round-Robin)
 */
export async function distribuirNovoLead(chatId: string) {
  const setorId = 'comercial-id'; // Foco no setor Comercial conforme solicitado
  
  try {
    // 1. Buscar todos os usuários ONLINE do setor Comercial
    const q = query(
      collection(db, 'usuarios'), 
      where('setorId', '==', setorId),
      where('status', '==', 'online')
    );
    
    const snapUsuarios = await getDocs(q);
    const atendentesDisponiveis = snapUsuarios.docs.map(d => ({ id: d.id, ...d.data() }));

    if (atendentesDisponiveis.length === 0) {
      console.warn('Nenhum atendente online no Comercial para distribuir o lead.');
      return;
    }

    // 2. Consultar quem foi o último vendedor a receber um lead
    const configRef = doc(db, 'config', `distribuicao_${setorId}`);
    const configSnap = await getDoc(configRef);
    let ultimoVendedorId = configSnap.exists() ? configSnap.data().ultimoVendedorId : null;

    // 3. Determinar o PRÓXIMO atendente na fila
    let proximoIndex = 0;
    if (ultimoVendedorId) {
      const lastIndex = atendentesDisponiveis.findIndex(a => a.id === ultimoVendedorId);
      if (lastIndex !== -1) {
        proximoIndex = (lastIndex + 1) % atendentesDisponiveis.length;
      }
    }
    
    const proximoAtendente = atendentesDisponiveis[proximoIndex];

    // 4. Atribuir o chat ao novo atendente
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      atendenteId: proximoAtendente.id,
      status: 'aguardando_confirmacao',
      distribuidoEm: serverTimestamp(),
      responsabilidade: 'humano'
    });

    // 5. Atualizar o controle de distribuição
    await setDoc(configRef, { 
      ultimoVendedorId: proximoAtendente.id,
      ultimoSetorId: setorId,
      atualizadoEm: serverTimestamp()
    });

    console.log(`Lead ${chatId} distribuído para ${proximoAtendente.id} via Round-Robin.`);
  } catch (error) {
    console.error('Erro na distribuição Round-Robin:', error);
  }
}
