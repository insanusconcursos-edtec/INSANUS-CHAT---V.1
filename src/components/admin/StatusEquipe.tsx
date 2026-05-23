/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase/config';
import { onSnapshotWithRetry } from '@/src/lib/firebase/listeners';
import { 
  Clock, 
  UserCheck, 
  UserMinus, 
  MessageCircle, 
  Activity,
  ChevronRight
} from 'lucide-react';
import type { Usuario, Chat } from '@/src/types';

export default function StatusEquipe() {
  const [vendedores, setVendedores] = useState<Usuario[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Escutar Status dos Vendedores em Tempo Real
    const qUsuarios = query(
      collection(db, 'usuarios'),
      where('setorId', '==', 'comercial-id')
    );

    const unsubUsuarios = onSnapshotWithRetry(qUsuarios, (snap) => {
      const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Usuario);
      setVendedores(users.sort((a, b) => a.nome.localeCompare(b.nome)));
      setLoading(false);
    }, 'status_vendedores');

    // 2. Escutar Chats Ativos para contar Leads por Vendedor
    const qChats = query(
      collection(db, 'chats'),
      where('status', '!=', 'encerrado')
    );

    const unsubChats = onSnapshotWithRetry(qChats, (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const chat = doc.data() as Chat;
        if (chat.atendenteId) {
          counts[chat.atendenteId] = (counts[chat.atendenteId] || 0) + 1;
        }
      });
      setLeadCounts(counts);
    }, 'counts_leads');

    return () => {
      unsubUsuarios();
      unsubChats();
    };
  }, []);

  const formatarUltimaAtividade = (timestamp: any) => {
    if (!timestamp) return 'Nunca';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const totalOnline = vendedores.filter(v => v.status === 'online').length;

  if (loading) return null;

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
            <Activity className="text-indigo-600" size={20} /> Vendedores Online
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
            Monitoramento de Disponibilidade em Tempo Real
          </p>
        </div>
        <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest">{totalOnline} Online Agora</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {vendedores.map((vendedor) => (
            <motion.div
              layout
              key={vendedor.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`p-5 rounded-[1.8rem] border transition-all flex flex-col gap-4 relative overflow-hidden group ${
                vendedor.status === 'online' 
                  ? 'bg-white border-slate-100 shadow-lg shadow-slate-50' 
                  : 'bg-slate-50 border-transparent opacity-60 grayscale'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black shadow-lg ${
                    vendedor.status === 'online' ? 'bg-indigo-600 shadow-indigo-100' : 'bg-slate-400'
                  }`}>
                    {vendedor.nome.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 truncate max-w-[120px]">{vendedor.nome}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {vendedor.status === 'online' ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Online</span>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Offline</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-end gap-1 mb-1">
                    <Clock size={10} /> {formatarUltimaAtividade(vendedor.ultimaAtividade)}
                  </div>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                    vendedor.status === 'online' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <MessageCircle size={10} /> {leadCounts[vendedor.id] || 0} Leads
                  </div>
                </div>
              </div>

              {/* Decorative hover effect */}
              <div className="absolute -right-2 -bottom-2 text-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity">
                <UserCheck size={64} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {vendedores.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
          <UserMinus size={48} className="mb-4 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest">Nenhum vendedor cadastrado no setor comercial</p>
        </div>
      )}
    </div>
  );
}
