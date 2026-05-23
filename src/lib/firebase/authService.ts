/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { auth, db } from './config';
import { atualizarStatusUsuario } from './statusService';
import type { Usuario } from '@/src/types';

/**
 * Realiza login com email e senha
 */
export async function login(email: string, pass: string) {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  if (result.user) {
    await atualizarStatusUsuario(result.user.uid, 'online');
  }
  return result.user;
}

/**
 * Realiza logout
 */
export async function logout() {
  const currentUser = auth.currentUser;
  if (currentUser) {
    await atualizarStatusUsuario(currentUser.uid, 'offline');
  }
  await signOut(auth);
}

/**
 * Busca metadados do usuário no Firestore
 */
export async function getUsuarioData(uid: string): Promise<Usuario | null> {
  const docRef = doc(db, 'usuarios', uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Usuario;
  }
  return null;
}

/**
 * Garante que um usuário exista no banco (para fins de demonstração/setup inicial)
 */
export async function ensureUsuarioDocument(user: User, papel: 'admin' | 'agente' = 'agente') {
  const docRef = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(docRef);
  
  if (!snap.exists()) {
    const newUser: Usuario = {
      id: user.uid,
      nome: user.displayName || user.email?.split('@')[0] || 'Usuário',
      email: user.email || '',
      papel,
      setorId: 'comercial-id', // Default para exemplo
      status: 'online'
    };
    await setDoc(docRef, newUser);
    return newUser;
  }
  return snap.data() as Usuario;
}

/**
 * Cadastra um novo membro da equipe (uso administrativo)
 * Nota: Por limitações do Firebase Client SDK, criar um novo usuário via Auth irá deslogar o admin.
 * Em um cenário real de produção, isso seria feito via Firebase Admin SDK (Cloud Functions ou Backend).
 */
export async function cadastrarNovoUsuarioEquipe(
  prefixo: string, 
  senha: string, 
  setorId: string, 
  papel: 'admin' | 'agente', 
  nomeCompleto: string
) {
  const email = `${prefixo}@chatinsanus.com`;
  
  try {
    // 1. Criar no Authentication
    const result = await createUserWithEmailAndPassword(auth, email, senha);
    const user = result.user;

    await updateProfile(user, { displayName: nomeCompleto });

    // 2. Criar no Firestore
    const novoUsuario: Usuario = {
      id: user.uid,
      nome: nomeCompleto,
      email: email,
      papel: papel,
      setorId: setorId,
      status: 'online'
    };

    await setDoc(doc(db, 'usuarios', user.uid), novoUsuario);
    
    return { success: true, user: novoUsuario };
  } catch (error: any) {
    console.error("Erro ao cadastrar membro da equipe:", error);
    throw error;
  }
}

/**
 * Lista todos os membros da equipe cadastrados no Firestore
 */
export async function listarEquipe(): Promise<Usuario[]> {
  const q = query(collection(db, 'usuarios'), orderBy('nome', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Usuario);
}
