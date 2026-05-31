/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  MoreVertical, 
  UserPlus, 
  RefreshCw, 
  Bot, 
  User,
  ShieldCheck,
  Sparkles,
  CalendarDays,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { escutarMensagensChat } from '@/src/lib/firebase/listeners';
import { salvarMensagem, atribuirAtendente, confirmarAtendimento } from '@/src/lib/firebase/services';
import { criarLembrete } from '@/src/lib/firebase/lembreteService';
import type { Chat, Mensagem } from '@/src/types';

interface VisualizadorChatProps {
  chat: Chat;
  currentUserId: string; // Simulated current user ID
  isAdmin: boolean;
}

export default function VisualizadorChat({ chat, currentUserId, isAdmin }: VisualizadorChatProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [sugestaoIa, setSugestaoIa] = useState<{ texto: string; acao: string } | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarBroken(false);
  }, [chat.id]);

  const isAguardandoMinhaConfirmacao = chat.status === 'aguardando_confirmacao' && chat.atendenteId === currentUserId;
  const emFailoverIA = chat.responsabilidade === 'ia' && chat.avisoFailover;

  const handleIniciarAtendimento = async () => {
    await confirmarAtendimento(chat.id);
  };

  useEffect(() => {
    const unsubscribe = escutarMensagensChat(chat.id, (novasMsgs) => {
      setMensagens(novasMsgs);
      
      // Lógica de sugestão da IA (Trigger simples)
      const ultimaMsgCliente = [...novasMsgs].reverse().find(m => m.remetente === 'cliente');
      if (ultimaMsgCliente) {
        const texto = ultimaMsgCliente.texto.toLowerCase();
        if (texto.includes('amanhã') || texto.includes('dia') || texto.includes('fatura') || texto.includes('boleto')) {
          setSugestaoIa({
            texto: "Detectamos uma possível promessa ou prazo. Deseja criar um alerta de follow-up?",
            acao: "Agendar Alerta"
          });
        } else {
          setSugestaoIa(null);
        }
      }
    });
    return () => unsubscribe();
  }, [chat.id]);

  const handleCriarLembreteIA = async () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    
    await criarLembrete({
      chatId: chat.id,
      atendenteId: currentUserId,
      clienteNome: chat.clienteNome,
      descricao: "Follow-up automático sugerido pela IA: Verificação de compromisso.",
      dataHora: amanha,
      prioridade: 'normal',
      configuracaoAntecedencia: '1h'
    });
    setSugestaoIa(null);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim()) return;
    const texto = novaMensagem;
    setNovaMensagem('');
    await salvarMensagem(chat.id, 'agente', texto);
  };

  const handleAssumir = async () => {
    await atribuirAtendente(chat.id, currentUserId);
  };

  const handleRedirecionarIA = async () => {
    // Simulated redirect back to IA (null means IA in our Logic)
    await atribuirAtendente(chat.id, null as any); 
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100/30 overflow-hidden">
      {/* Admin Control Banner */}
      {isAdmin && (
        <div className="bg-slate-900 px-6 py-2 flex items-center justify-between shadow-2xl relative z-20">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <ShieldCheck size={14} className="text-indigo-400" />
            Controle de Gerência
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleAssumir}
              disabled={chat.atendenteId === currentUserId && chat.status !== 'aguardando_confirmacao'}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 rounded-md text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 flex items-center gap-2 shadow-sm"
            >
              <UserPlus size={12} />
              Assumir Conversa
            </button>
            <button 
              onClick={handleRedirecionarIA}
              className="px-3 py-1 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <RefreshCw size={12} />
              Voltar p/ IA
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Banner (Round-Robin) */}
      <AnimatePresence>
        {isAguardandoMinhaConfirmacao && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-indigo-600 px-8 py-4 flex items-center justify-between border-b border-indigo-700 shadow-lg relative z-20"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">Novo Lead Distribuído</p>
                <p className="text-sm font-black text-white tracking-tight">O sistema Round-Robin enviou este lead para você.</p>
              </div>
            </div>
            <button 
              onClick={handleIniciarAtendimento}
              className="px-6 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-xl shadow-indigo-900/20"
            >
              Iniciar Atendimento
            </button>
          </motion.div>
        )}

        {/* Failover Alert */}
        {!isAguardandoMinhaConfirmacao && emFailoverIA && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 px-8 py-3 flex items-center justify-between border-b border-amber-600 relative z-20"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-white" />
              <p className="text-[10px] font-black text-white uppercase tracking-widest">
                {chat.avisoFailover}
              </p>
            </div>
            {chat.atendenteId === null && (
              <button 
                onClick={handleAssumir}
                className="px-4 py-1.5 bg-white/20 text-white border border-white/40 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white/30 transition-all"
              >
                Assumir Conversa
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0 w-10 h-10">
            {chat.clienteFoto && !avatarBroken ? (
              <img
                src={chat.clienteFoto}
                alt={chat.clienteNome}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover shadow-md"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-md ${
                chat.atendenteId ? 'bg-indigo-600' : 'bg-emerald-500'
              }`}>
                {chat.clienteNome.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-md shadow-sm border border-slate-100 flex items-center justify-center">
              {chat.atendenteId ? <User size={10} className="text-indigo-600" /> : <Bot size={10} className="text-emerald-500" />}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 tracking-tight">{chat.clienteNome}</h2>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${chat.iaStatus === 'pensando' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                {chat.iaStatus === 'pensando' ? 'IA está processando resposta...' : `Ativo via ${chat.canal}`}
              </span>
            </div>
          </div>
        </div>
        <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
          <MoreVertical size={20} />
        </button>
      </header>

      {/* Mensagens Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 scrollbar-thin"
      >
        <AnimatePresence initial={false}>
          {mensagens.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <footer className="p-6 bg-white border-t border-slate-200">
        <AnimatePresence>
          {sugestaoIa && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <Sparkles size={16} />
                </div>
                <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-tighter">
                  {sugestaoIa.texto}
                </p>
              </div>
              <button 
                onClick={handleCriarLembreteIA}
                className="px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <CalendarDays size={12} />
                {sugestaoIa.acao}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleEnviar} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2 pl-5 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all shadow-inner">
          <input 
            type="text" 
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            placeholder="Digite sua resposta oficial..." 
            className="flex-1 bg-transparent border-none outline-none py-3 text-sm text-slate-700 placeholder:text-slate-400 font-medium"
          />
          <button 
            type="submit"
            disabled={!novaMensagem.trim()}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200"
          >
            <Send size={14} />
            Enviar
          </button>
        </form>
      </footer>
    </div>
  );
}

function MessageBubble({ message }: { message: Mensagem; key?: string }) {
  const isAgente = message.remetente === 'agente';
  const isIa = message.remetente === 'ia';
  const isSistema = message.remetente === 'sistema';

  if (isSistema) {
    return (
      <div className="flex justify-center my-4">
        <span className="px-5 py-1.5 bg-slate-900 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-slate-800 shadow-sm">
          {message.texto}
        </span>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: isAgente ? 20 : -20, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={`flex ${isAgente ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[75%] rounded-2xl px-6 py-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border transition-all ${
        isAgente 
          ? 'bg-slate-900 border-slate-800 text-slate-100 rounded-tr-none' 
          : isIa 
            ? 'bg-indigo-600 text-white border-indigo-500 rounded-tl-none shadow-indigo-100'
            : 'bg-white text-slate-700 border-slate-100 rounded-tl-none'
      }`}>
        {isIa && (
          <div className="flex items-center gap-2 mb-3 opacity-80">
            <div className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center">
              <Bot size={12} className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Vendedor Virtual</span>
          </div>
        )}
        <p className="text-[13px] leading-relaxed font-medium">{message.texto}</p>
        <div className={`text-[9px] mt-3 text-right font-black uppercase tracking-tighter opacity-40 ${isAgente || isIa ? 'text-slate-300' : 'text-slate-500'}`}>
          {message.timestamp instanceof Date 
             ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
             : 'Processado'}
        </div>
      </div>
    </motion.div>
  );
}
