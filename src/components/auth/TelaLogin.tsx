/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, ShieldCheck, AlertCircle, Loader2, Database } from 'lucide-react';
import { login } from '@/src/lib/firebase/authService';
import { executarSeedDeDados } from '@/src/lib/firebase/seedUsuarios';

export default function TelaLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const handleSeed = async () => {
    setCarregando(true);
    try {
      await executarSeedDeDados();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 5000);
    } catch (err) {
      setErro('Falha ao executar carga de dados inicial.');
    } finally {
      setCarregando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const finalEmail = email.includes('@') ? email : `${email}@chatinsanus.com`;

    try {
      await login(finalEmail, senha);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setErro('Credenciais incorretas. Verifique seu e-mail e senha.');
      } else {
        setErro('Ocorreu um erro ao tentar entrar. Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200/60 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-0 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-200">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2 uppercase">Omni CRM Vendas</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest leading-none opacity-50">Plataforma de Conversão IA</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 pt-10 space-y-5">
            {erro && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-rose-700 leading-relaxed">{erro}</p>
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Seu Usuário ou E-mail</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 transition-all focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none placeholder:text-slate-300"
                  placeholder="ex: joao.vendas ou seu@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sua Senha</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 transition-all focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none placeholder:text-slate-300"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={carregando}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {carregando ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  Entrar no Painel
                </>
              )}
            </button>

            <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-tighter pt-4">
              Protegido por Criptografia de Ponta-a-Ponta
            </p>
          </form>

          {/* Seed Initial Data - Temporary Helper */}
          <div className="p-8 pt-0 border-t border-slate-100 bg-slate-50/50">
            <div className="pt-6">
              <button 
                type="button"
                onClick={handleSeed}
                disabled={carregando}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 group"
              >
                <Database size={14} className="group-hover:animate-pulse" />
                {carregando ? "Carregando..." : seedSuccess ? "Sucesso! Use as credenciais do script" : "Configurar Dados Iniciais (Seed)"}
              </button>
              {seedSuccess && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <p className="text-[9px] font-bold text-emerald-700 uppercase leading-relaxed">
                    Setores e usuários criados! Verifique o arquivo <span className="underline italic">seedUsuarios.ts</span> para ver os logins de teste (ex: admin@insanuschat.com).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
