/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, 
  Plus, 
  Calendar, 
  Users, 
  Send, 
  BarChart3, 
  X, 
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { escutarCampanhas, criarCampanha } from '@/src/lib/firebase/campanhaService';
import type { Campanha, CanalAtendimento } from '@/src/types';

export default function PainelCampanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [newMode, setNewMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [canal, setCanal] = useState<CanalAtendimento | ''>('');
  const [agendadoPara, setAgendadoPara] = useState('');

  useEffect(() => {
    const unsub = escutarCampanhas(setCampanhas);
    return () => unsub();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await criarCampanha({
        nome,
        mensagem,
        agendadoPara: agendadoPara ? new Date(agendadoPara) : null,
        filtros: {
          canal: canal || undefined
        }
      });
      setNewMode(false);
      setNome('');
      setMensagem('');
      setCanal('');
      setAgendadoPara('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="p-8 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <Megaphone className="text-indigo-600" /> Campanhas Ativas
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              CRM de Engajamento e Transmissão Turbo
            </p>
          </div>
          <button 
            onClick={() => setNewMode(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
          >
            <Plus size={16} /> Nova Campanha
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-6">
          <StatCard icon={<Send size={16} />} label="Total Disparado" value="24.8k" color="bg-indigo-50 text-indigo-600" />
          <StatCard icon={<CheckCircle2 size={16} />} label="Taxa de Entrega" value="98.2%" color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={<Users size={16} />} label="Novos Leads" value="1.2k" color="bg-amber-50 text-amber-600" />
        </div>
      </div>

      {/* Campaign List */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {campanhas.map((camp) => (
          <div key={camp.id} className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  camp.status === 'agendada' ? 'bg-indigo-50 text-indigo-600' :
                  camp.status === 'processando' ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-50 text-slate-400'
                }`}>
                  {camp.status === 'agendada' ? <Clock size={24} /> : <BarChart3 size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">{camp.nome}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] font-black uppercase tracking-widest py-0.5 px-2 bg-slate-100 text-slate-500 rounded-md">
                      {camp.filtros.canal || 'Todos Canais'}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Calendar size={10} /> Criado em {camp.criadoEm.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                camp.status === 'agendada' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                camp.status === 'concluida' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                'bg-slate-50 text-slate-400'
              }`}>
                {camp.status}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <p className="text-xs text-slate-600 leading-relaxed font-medium italic">
                "{camp.mensagem}"
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                <span className="text-slate-400">Progresso do Disparo</span>
                <span className="text-slate-900">{camp.enviados} de {camp.totalAlvos} envios</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(camp.enviados / (camp.totalAlvos || 1)) * 100}%` }}
                  className="h-full bg-indigo-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Campaign Modal */}
      <AnimatePresence>
        {newMode && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setNewMode(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Configurar Campanha</h2>
                  <button onClick={() => setNewMode(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome da Operação</label>
                    <input 
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Black Friday 2024 - Reaquecimento"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canal de Disparo</label>
                      <select 
                        value={canal}
                        onChange={(e) => setCanal(e.target.value as any)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none"
                      >
                        <option value="">Todos os Canais</option>
                        <option value="whatsapp">WhatsApp Business</option>
                        <option value="instagram">Instagram Direct</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agendar Disparo</label>
                      <input 
                        type="datetime-local"
                        value={agendadoPara}
                        onChange={(e) => setAgendadoPara(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Script de Vendas (Mensagem)</label>
                    <textarea 
                      required
                      rows={4}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Olá! Temos uma oferta exclusiva para quem quer ser aprovado ainda este ano..."
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white outline-none resize-none"
                    />
                  </div>

                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
                    <p className="text-[11px] font-bold text-amber-900 uppercase tracking-tighter leading-relaxed">
                      Lembre-se: Campanhas ativas devem seguir as diretrizes da Meta para evitar bloqueios. 
                      Sugerimos o uso de variáveis humanizadas.
                    </p>
                  </div>

                  <button 
                    disabled={loading}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? "Processando..." : (
                      <>
                        <Megaphone size={20} />
                        Lançar Campanha
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className={`p-4 rounded-3xl ${color} flex items-center justify-between`}>
      <div>
        <div className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
        <div className="text-xl font-black tracking-tight">{value}</div>
      </div>
      <div className="w-10 h-10 rounded-2xl bg-white/40 flex items-center justify-center">
        {icon}
      </div>
    </div>
  );
}
