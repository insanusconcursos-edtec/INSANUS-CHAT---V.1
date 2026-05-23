/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  writeBatch 
} from 'firebase/firestore';
import { auth, db } from './config';
import type { Usuario } from '@/src/types';

/**
 * Script de inicialização (Seed) para o INSANUS CHAT
 * Cria setores e usuários iniciais para testes de carteirização.
 */
export async function executarSeedDeDados() {
  console.log('[Seed] Iniciando carga de dados...');

  try {
    // 1. Criar Setores
    const setores = [
      { id: 'comercial-id', nome: 'VENDAS', cor: 'indigo' },
      { id: 'financeiro-id', nome: 'Financeiro', cor: 'rose' },
      { id: 'pedagogico-id', nome: 'Suporte Pedagógico', cor: 'emerald' }
    ];

    const batch = writeBatch(db);
    setores.forEach(setor => {
      batch.set(doc(db, 'setores', setor.id), setor);
    });
    await batch.commit();
    console.log('[Seed] Setores criados com sucesso.');

    // 2. Definir Usuários
    const usuariosParaCriar = [
      {
        email: 'admin@insanuschat.com',
        senha: 'admin123',
        nome: 'Admin Geral',
        papel: 'admin' as const,
        setorId: 'todos'
      },
      {
        email: 'vendas@insanuschat.com',
        senha: 'vendas123',
        nome: 'Atendente Comercial',
        papel: 'agente' as const,
        setorId: 'comercial-id'
      },
      {
        email: 'financeiro@insanuschat.com',
        senha: 'financeiro123',
        nome: 'Atendente Financeiro',
        papel: 'agente' as const,
        setorId: 'financeiro-id'
      },
      {
        email: 'suporte@insanuschat.com',
        senha: 'suporte123',
        nome: 'Atendente Pedagógico',
        papel: 'agente' as const,
        setorId: 'pedagogico-id'
      }
    ];

    const resultados = [];

    for (const u of usuariosParaCriar) {
      try {
        // Criar no Auth
        const userCredential = await createUserWithEmailAndPassword(auth, u.email, u.senha);
        const { user } = userCredential;

        await updateProfile(user, { displayName: u.nome });

        // Criar no Firestore
        const usuarioDoc: Usuario = {
          id: user.uid,
          nome: u.nome,
          email: u.email,
          papel: u.papel,
          setorId: u.setorId,
          status: 'online'
        };

        await setDoc(doc(db, 'usuarios', user.uid), usuarioDoc);
        
        resultados.push({ ...u, uid: user.uid });
        console.log(`[Seed] Usuário criado: ${u.email}`);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          console.warn(`[Seed] E-mail já em uso: ${u.email}. Pulando criação Auth.`);
          // Tentar apenas atualizar o Firestore se já existir no Auth (ou deixar como está)
        } else {
          throw err;
        }
      }
    }

    return {
      success: true,
      mensagem: "Carga inicial concluída com sucesso!",
      usuarios: usuariosParaCriar
    };

  } catch (error) {
    console.error('[Seed] Falha na carga de dados:', error);
    throw error;
  }
}
