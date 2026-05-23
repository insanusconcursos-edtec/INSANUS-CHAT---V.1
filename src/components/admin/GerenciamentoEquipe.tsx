/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Hash,
  Briefcase
} from 'lucide-react';
import { cadastrarNovoUsuarioEquipe, listarEquipe } from '@/src/lib/firebase/authService';
import StatusEquipe from './StatusEquipe';
import type { Usuario } from '@/src/types';

export default function GerenciamentoEquipe() {
  const [equipe, setEquipe] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [prefixo, setPrefixo] = useState('');
  const [setorId, setSetorId] = useState('comercial-id');
  const [papel, setPapel] = useState<'admin' | 'agente'>('agente');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmaSenha, setShowConfirmaSenha] = useState(false);

  useEffect(() => {
    carregarEquipe();
  }, []);

  const carregarEquipe = async () => {
    try {
      const data = await listarEquipe();
      setEquipe(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isValido = () => {
    return (
      nome.trim().length > 0 &&
      prefixo.trim().length > 0 &&
      senha.length >= 6 &&
      senha === confirmaSenha
    );
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValido()) return;

    setSaving(true);
    setStatus(null);

    try {
      await cadastrarNovoUsuarioEquipe(prefixo, senha, setorId, papel, nome);
      setStatus({ type: 'success', text: `Usuário ${prefixo}@chatinsanus.com criado com sucesso!` });
      
      // Reset form
      setNome('');
      setPrefixo('');
      setSenha('');
      setConfirmaSenha('');
      
      // Reload list
      carregarEquipe();
    } catch (error: any) {
      const errorMsg = error.code === 'auth/email-already-in-use' 
        ? 'Este e-mail já está sendo utilizado.' 
        : 'Erro ao cadastrar usuário. Tente novamente.';
      setStatus({ type: 'error', text: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Gestão de Equipe
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1 italic">
              Controle de Acessos e Níveis Hierárquicos
            </p>
          </div>
        </div>
      </div>

      <StatusEquipe />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100 sticky top-8">
            <h2 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-2 uppercase tracking-tight">
              <UserPlus className="text-indigo-600" size={20} /> Novo Integrante
            </h2>

            <form onSubmit={handleCadastro} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
                <input 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Felipe Gonçalves"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail (Prefixo)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input 
                    value={prefixo}
                    onChange={(e) => setPrefixo(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="felipe.vendas"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500/50 uppercase tracking-tighter">
                    @chatinsanus.com
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Setor</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Briefcase size={16} />
                    </div>
                    <select 
                      value={setorId}
                      onChange={(e) => setSetorId(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white outline-none transition-all appearance-none"
                    >
                      <option value="comercial-id">Comercial</option>
                      <option value="financeiro-id">Financeiro</option>
                      <option value="pedagogico-id">Pedagógico</option>
                      <option value="todos">Todos (Admin)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nível</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Shield size={16} />
                    </div>
                    <select 
                      value={papel}
                      onChange={(e) => setPapel(e.target.value as any)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white outline-none transition-all appearance-none"
                    >
                      <option value="agente">Atendente</option>
                      <option value="admin">Gerente</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Senha de Acesso</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input 
                    type={showSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirmar Senha</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input 
                    type={showConfirmaSenha ? "text" : "password"}
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmaSenha(!showConfirmaSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    {showConfirmaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {status && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl flex items-start gap-3 border ${
                    status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                  }`}
                >
                  {status.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
                  <p className="text-[11px] font-bold uppercase tracking-tight leading-relaxed">{status.text}</p>
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={saving || !isValido()}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <UserPlus size={20} />
                    Cadastrar Atendente
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100 min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <Users className="text-indigo-600" size={20} /> Membros Ativos
              </h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                {equipe.length} Cadastrados
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                <Loader2 size={32} className="animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Lista...</p>
              </div>
            ) : equipe.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem]">
                <p className="text-[10px] font-black uppercase tracking-widest italic tracking-tight">Nenhum membro cadastrado ainda</p>
              </div>
            ) : (
              <div className="space-y-4">
                {equipe.map((membro) => (
                  <motion.div 
                    layout
                    key={membro.id}
                    className="group bg-slate-50/50 hover:bg-white hover:border-indigo-100 border border-transparent rounded-[1.8rem] p-4 flex items-center gap-4 transition-all"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg ${
                      membro.papel === 'admin' ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}>
                      {membro.nome.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-800">{membro.nome}</h4>
                        {membro.papel === 'admin' && (
                          <span className="text-[8px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">Admin</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">{membro.email}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Setor</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-900 py-1 px-3 bg-white border border-slate-100 rounded-lg">
                        {membro.setorId.replace('-id', '')}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Tips card */}
          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4">Integridade de Credenciais</h3>
            <p className="text-[11px] font-bold text-indigo-100 leading-relaxed uppercase tracking-tighter">
              As contas criadas são exclusivas para o sistema INSANUS. 
              Ao criar um novo perfil, certifique-se de passar a senha provisória ao atendente. 
              As regras de carteirização por setor são aplicadas instantaneamente após o login.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
