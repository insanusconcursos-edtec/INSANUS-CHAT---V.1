/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  LayoutGrid, 
  TrendingUp, 
  DollarSign, 
  GraduationCap, 
  AlertCircle,
  MessageCircle,
  Instagram,
  ChevronDown,
  ChevronRight,
  Monitor
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';

interface Sector {
  id: string;
  nome: string;
  icon: React.ReactNode;
}

const SETORES_LIST: Sector[] = [
  { id: 'all', nome: 'Todos', icon: <LayoutGrid size={18} /> },
  { id: 'triagem-id', nome: 'Triagem', icon: <AlertCircle size={18} /> },
  { id: 'comercial-id', nome: 'Comercial', icon: <TrendingUp size={18} /> },
  { id: 'financeiro-id', nome: 'Financeiro', icon: <DollarSign size={18} /> },
  { id: 'pedagogico-id', nome: 'Suporte Pedagógico', icon: <GraduationCap size={18} /> },
];

interface CanalFilter {
  type: 'all' | 'whatsapp' | 'instagram';
  brand?: string;
}

interface BarraLateralSetoresProps {
  selectedSectorId: string;
  onSelectSector: (id: string) => void;
  selectedChannel: CanalFilter;
  onSelectChannel: (filter: CanalFilter) => void;
  unansweredCount?: number;
  triageCount?: number;
}

export default function BarraLateralSetores({ 
  selectedSectorId, 
  onSelectSector,
  selectedChannel,
  onSelectChannel,
  unansweredCount = 0,
  triageCount = 0
}: BarraLateralSetoresProps) {
  const { userData } = useAuth();
  const [isInstagramExpanded, setIsInstagramExpanded] = useState(true);

  const setoresPermitidos = useMemo(() => {
    if (!userData) return [];
    if (userData.papel === 'admin') return SETORES_LIST;
    
    // Agente vê APENAS o seu setor (Exclui 'Todos', 'Triagem', etc)
    return SETORES_LIST.filter(s => s.id === userData.setorId);
  }, [userData]);

  // Se o setor selecionado não estiver na lista permitida (ex: agente logando e estava 'all'), reseta.
  React.useEffect(() => {
    if (setoresPermitidos.length > 0) {
      const isPermitido = setoresPermitidos.some(s => s.id === selectedSectorId);
      if (!isPermitido) {
        onSelectSector(setoresPermitidos[0].id);
      }
    }
  }, [setoresPermitidos, selectedSectorId, onSelectSector]);

  return (
    <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-y-auto">
      <div className="p-6">
        {/* SEÇÃO: SETORES */}
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
          Setores e Filtros
        </h2>
        
        <nav className="space-y-1 mb-8">
          {setoresPermitidos.map((sector) => (
            <button
              key={sector.id}
              onClick={() => onSelectSector(sector.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                selectedSectorId === sector.id 
                ? 'bg-white shadow-sm border border-slate-200 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${selectedSectorId === sector.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {sector.icon}
                </span>
                <span className="text-sm font-bold tracking-tight">{sector.nome}</span>
              </div>
              
              {sector.id === 'triagem-id' && triageCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_2px_4px_rgba(245,158,11,0.3)]">
                  {triageCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* SEÇÃO: CANAIS */}
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
          Canais
        </h2>

        <nav className="space-y-1">
          {/* Todos os Canais */}
          <button
            onClick={() => onSelectChannel({ type: 'all' })}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              selectedChannel.type === 'all'
              ? 'bg-white shadow-sm border border-slate-200 text-indigo-600'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Monitor size={18} className={selectedChannel.type === 'all' ? 'text-indigo-600' : 'text-slate-400'} />
            <span className="text-sm font-bold tracking-tight">Todos os Canais</span>
          </button>

          {/* WhatsApp */}
          <button
            onClick={() => onSelectChannel({ type: 'whatsapp' })}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              selectedChannel.type === 'whatsapp'
              ? 'bg-white shadow-sm border border-slate-200 text-emerald-600'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <MessageCircle size={18} className={selectedChannel.type === 'whatsapp' ? 'text-emerald-500' : 'text-slate-400'} />
            <span className="text-sm font-bold tracking-tight">WhatsApp</span>
          </button>

          {/* Instagram (Expansível) */}
          <div className="space-y-1">
            <button
              onClick={() => {
                if (selectedChannel.type !== 'instagram') {
                  onSelectChannel({ type: 'instagram' });
                }
                setIsInstagramExpanded(!isInstagramExpanded);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                selectedChannel.type === 'instagram' && !selectedChannel.brand
                ? 'bg-white shadow-sm border border-slate-200 text-pink-600'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Instagram size={18} className={selectedChannel.type === 'instagram' ? 'text-pink-500' : 'text-slate-400'} />
                <span className="text-sm font-bold tracking-tight">Instagram</span>
              </div>
              {isInstagramExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isInstagramExpanded && (
              <div className="ml-4 pl-4 border-l border-slate-200 space-y-1 py-1">
                {[
                  { brand: 'insanus', label: 'IG: Insanus' },
                  { brand: 'gabarito', label: 'IG: Gabarito' },
                  { brand: 'enem', label: 'IG: ENEM' }
                ].map(item => (
                  <button
                    key={item.brand}
                    onClick={() => onSelectChannel({ type: 'instagram', brand: item.brand })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                      selectedChannel.brand === item.brand
                      ? 'bg-pink-50 text-pink-600'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="mt-12 bg-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Status Geral</h3>
          <div className="text-2xl font-black mb-4">{unansweredCount}</div>
          <p className="text-[10px] font-bold opacity-70 leading-relaxed uppercase tracking-tighter">
            Conversas aguardando retorno ou triagem automática
          </p>
        </div>
      </div>
    </div>
  );
}
