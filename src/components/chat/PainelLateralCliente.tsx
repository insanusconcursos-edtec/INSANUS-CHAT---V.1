/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Info, 
  MapPin, 
  DollarSign, 
  Zap, 
  ChevronRight,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import type { Chat, EtapaFunil } from '@/src/types';
import { alterarEtapaFunil } from '@/src/lib/firebase/services';

const ETAPAS: { id: EtapaFunil; label: string; color: string }[] = [
  { id: 'novo', label: 'Novo Contato', color: 'bg-indigo-500' },
  { id: 'negociacao', label: 'Negociação', color: 'bg-amber-500' },
  { id: 'aguardando_retorno', label: 'Aguardando', color: 'bg-rose-500' },
  { id: 'fechado', label: 'Fechado', color: 'bg-emerald-500' },
  { id: 'pos_venda', label: 'Pós-Venda', color: 'bg-blue-500' }
];

interface PainelLateralClienteProps {
  chat: Chat;
}

export default function PainelLateralCliente({ chat }: PainelLateralClienteProps) {
  
  const handleMudarEtapa = async (etapa: EtapaFunil) => {
    await alterarEtapaFunil(chat.id, etapa);
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto">
      <header className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb- aggregation-6 flex items-center gap-2">
          <Info size={14} /> Detalhes do Lead
        </h2>
      </header>

      <div className="p-6 space-y-8">
        {/* Kanban-style Etapa Selector */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4 flex justify-between items-center">
            Funil de Vendas
            <span className="text-[10px] text-slate-400 font-bold">1 clique para mudar</span>
          </h3>
          <div className="space-y-2">
            {ETAPAS.map((etapa) => (
              <button
                key={etapa.id}
                onClick={() => handleMudarEtapa(etapa.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${
                  chat.statusEtapa === etapa.id
                    ? 'bg-white border-slate-200 shadow-lg shadow-slate-100 ring-2 ring-indigo-500/10'
                    : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${etapa.color} ${chat.statusEtapa === etapa.id ? 'animate-pulse' : 'opacity-40'}`} />
                  <span className={`text-[11px] font-black uppercase tracking-tight ${
                    chat.statusEtapa === etapa.id ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                    {etapa.label}
                  </span>
                </div>
                {chat.statusEtapa === etapa.id && (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                )}
                {chat.statusEtapa !== etapa.id && (
                  <ArrowRight size={12} className="text-slate-200 group-hover:text-slate-400 transform translate-x-[-4px] group-hover:translate-x-0 transition-transform" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Details Card */}
        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl shadow-slate-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-2xl" />
          
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">
            Meta-informações
          </h3>

          <div className="space-y-5">
            <DetailItem icon={<MapPin size={14} />} label="Origem" value={chat.origem || 'Busca Orgânica'} />
            <DetailItem icon={<DollarSign size={14} />} label="Faixa de Preço" value="Lead Qualificado" />
            <DetailItem 
              icon={<Zap size={14} />} 
              label="Urgência" 
              value={chat.semRespostaDesde ? 'Alta Priority' : 'Normal'} 
              highlight={!!chat.semRespostaDesde}
            />
            <DetailItem 
              icon={<Clock size={14} />} 
              label="Última Mensagem" 
              value={chat.dataUltimaMensagem instanceof Date ? chat.dataUltimaMensagem.toLocaleDateString() : 'Hoje'} 
            />
          </div>
        </div>

        {/* Tags management (Summary) */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-3">Segmentação</h3>
          <div className="flex flex-wrap gap-2">
            {chat.tags?.map(tag => (
              <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-lg border border-indigo-100">
                {tag}
              </span>
            ))}
            {chat.tags?.length === 0 && (
              <span className="text-[10px] text-slate-400 italic">Nenhuma tag atribuída</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ 
  icon, 
  label, 
  value, 
  highlight = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  highlight?: boolean 
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-indigo-400">{icon}</div>
      <div>
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
        <div className={`text-xs font-bold leading-tight ${highlight ? 'text-amber-400' : 'text-slate-200'}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
