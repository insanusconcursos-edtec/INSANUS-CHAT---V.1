/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Chat } from '@/src/types';
import { Instagram, MessageCircle, Globe, Bot, User } from 'lucide-react';

interface ListaDeConversasProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
  isLoading: boolean;
}

export default function ListaDeConversas({ 
  chats, 
  selectedChatId, 
  onSelectChat,
  isLoading 
}: ListaDeConversasProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="text-slate-200" size={32} />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sem conversas</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => onSelectChat(chat.id)}
          className={`w-full p-5 flex items-start gap-4 border-b border-slate-50 transition-all text-left relative group ${
            selectedChatId === chat.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
          }`}
        >
          {selectedChatId === chat.id && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
          )}
          
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm transition-transform group-hover:scale-105 ${
              selectedChatId === chat.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {chat.clienteNome.substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
               {chat.canal === 'whatsapp' && <MessageCircle size={10} className="text-emerald-500" />}
               {chat.canal === 'instagram' && <Instagram size={10} className="text-pink-500" />}
               {chat.canal === 'site' && <Globe size={10} className="text-blue-500" />}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <h3 className={`text-sm font-black truncate tracking-tight ${selectedChatId === chat.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                {chat.clienteNome}
              </h3>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {chat.dataUltimaMensagem instanceof Date 
                  ? chat.dataUltimaMensagem.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Sincr.'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                chat.statusEtapa === 'novo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                chat.statusEtapa === 'negociacao' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                chat.statusEtapa === 'fechado' ? 'bg-emerald-500 text-white border-emerald-600' :
                'bg-slate-50 text-slate-600 border-slate-100'
              }`}>
                {chat.statusEtapa}
              </span>
              
              <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                {chat.atendenteId === null ? (
                  <div className="flex items-center gap-1">
                    <Bot size={12} className={chat.iaStatus === 'pensando' ? 'text-indigo-600 animate-bounce' : 'text-indigo-400'} /> 
                    <span className={`uppercase tracking-tighter ${chat.iaStatus === 'pensando' ? 'text-indigo-600' : ''}`}>
                      {chat.iaStatus === 'pensando' ? 'IA Escrevendo...' : 'IA Atuando'}
                    </span>
                  </div>
                ) : (
                  <><User size={12} /> <span className="uppercase tracking-tighter">Agente Humano</span></>
                )}
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {chat.tags?.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-400 text-[8px] font-black uppercase rounded shadow-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {chat.semRespostaDesde && (
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full mt-1.5 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.4)] flex-shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}
