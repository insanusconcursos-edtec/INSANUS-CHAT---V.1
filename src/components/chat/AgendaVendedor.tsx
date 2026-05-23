/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { escutarAgendaDia, concluirLembrete } from '@/src/lib/firebase/lembreteService';
import type { Lembrete } from '@/src/types';

interface AgendaVendedorProps {
  atendenteId: string;
}

export default function AgendaVendedor({ atendenteId }: AgendaVendedorProps) {
  const [agenda, setAgenda] = useState<Lembrete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = escutarAgendaDia(atendenteId, (itens) => {
      setAgenda(itens);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [atendenteId]);

  const handleConcluir = async (id: string) => {
    await concluirLembrete(id);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white">
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-4 flex items-center gap-2">
          <Calendar size={14} className="text-indigo-400" /> Agenda do Dia
        </h2>
        
        <div className="flex gap-2">
          <div className="flex-1 bg-indigo-50 rounded-xl p-3 border border-indigo-100/50">
            <div className="text-indigo-600 text-xl font-black">{agenda.filter(i => i.status === 'pendente').length}</div>
            <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">Pendentes</div>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-xl p-3 border border-emerald-100/50">
            <div className="text-emerald-600 text-xl font-black">{agenda.filter(i => i.status === 'concluido').length}</div>
            <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Ficou Pronto</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="text-center text-[10px] font-bold text-slate-400 uppercase py-8 animate-pulse italic">
            Sincronizando compromissos...
          </div>
        ) : agenda.length === 0 ? (
          <div className="text-center text-slate-400 py-12 px-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={24} className="opacity-20" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Agenda Livre</p>
          </div>
        ) : (
          agenda.map((item) => (
            <div 
              key={item.id} 
              className={`p-4 rounded-2xl border transition-all ${
                item.status === 'concluido' 
                ? 'bg-slate-100/50 border-slate-100 opacity-60' 
                : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    item.prioridade === 'urgente' ? 'bg-rose-500' : 
                    item.prioridade === 'atencao' ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} />
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                    {item.dataHora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {item.status === 'pendente' && (
                  <button 
                    onClick={() => handleConcluir(item.id)}
                    className="text-slate-300 hover:text-emerald-500 transition-colors"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
              
              <h4 className={`text-xs font-black mb-1 ${item.status === 'concluido' ? 'line-through' : 'text-slate-800'}`}>
                {item.clienteNome}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {item.descricao}
              </p>
              
              {item.status === 'pendente' && item.dataHora < new Date() && (
                <div className="mt-3 flex items-center gap-1.5 text-rose-500">
                  <AlertCircle size={12} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Atrasado</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
