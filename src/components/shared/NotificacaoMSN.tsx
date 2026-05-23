/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ExternalLink, AlertTriangle, Info, Zap } from 'lucide-react';
import type { Lembrete } from '@/src/types';

interface NotificacaoMSNProps {
  lembretes: Lembrete[];
  onClose: (id: string) => void;
  onAction: (chatId: string) => void;
}

export default function NotificacaoMSN({ lembretes, onClose, onAction }: NotificacaoMSNProps) {
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'urgente': return { bg: 'bg-rose-500', text: 'text-white', icon: <AlertTriangle size={16} /> };
      case 'atencao': return { bg: 'bg-amber-500', text: 'text-white', icon: <Zap size={16} /> };
      default: return { bg: 'bg-emerald-500', text: 'text-white', icon: <Info size={16} /> };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {lembretes.map((lembrete) => {
          const styles = getPriorityStyles(lembrete.prioridade);
          return (
            <motion.div
              key={lembrete.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="pointer-events-auto w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className={`px-4 py-2 flex items-center justify-between ${styles.bg} ${styles.text}`}>
                <div className="flex items-center gap-2">
                  {styles.icon}
                  <span className="text-[10px] font-black uppercase tracking-widest">Lembrete {lembrete.prioridade}</span>
                </div>
                <button onClick={() => onClose(lembrete.id)} className="hover:opacity-70 transition-opacity">
                  <X size={14} />
                </button>
              </div>
              
              <div className="p-4">
                <h4 className="text-sm font-black text-slate-800 mb-1">{lembrete.clienteNome}</h4>
                <p className="text-xs text-slate-500 mb-4 line-clamp-2 font-medium">
                  {lembrete.descricao}
                </p>
                
                <button
                  onClick={() => onAction(lembrete.chatId)}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                >
                  <ExternalLink size={12} />
                  Abrir Negociação
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
