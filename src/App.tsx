/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, 
  Users, 
  LogOut, 
  Filter,
  Plus,
  CalendarDays,
  Clock,
  Bell,
  Megaphone,
  Terminal,
  Shield
} from 'lucide-react';
import { 
  escutarChatsCarteira 
} from '@/src/lib/firebase/listeners';
import { 
  criarNovoChat, 
  salvarMensagem, 
  testarConexao 
} from '@/src/lib/firebase/services';
import { iniciarMonitoramentoTriagem } from '@/src/lib/firebase/iaWorker';
import type { Chat } from '@/src/types';

// Componentes Modulares
import BarraLateralSetores from '@/src/components/chat/BarraLateralSetores';
import ListaDeConversas from '@/src/components/chat/ListaDeConversas';
import VisualizadorChat from '@/src/components/chat/VisualizadorChat';
import PainelLateralCliente from '@/src/components/chat/PainelLateralCliente';
import NotificacaoMSN from '@/src/components/shared/NotificacaoMSN';
import AgendaVendedor from '@/src/components/chat/AgendaVendedor';
import TelaLogin from '@/src/components/auth/TelaLogin';
import PainelCampanhas from '@/src/components/chat/PainelCampanhas';
import PlaygroundSimulacao from '@/src/components/admin/PlaygroundSimulacao';
import GerenciamentoEquipe from '@/src/components/admin/GerenciamentoEquipe';

// Context & Services
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { logout, ensureUsuarioDocument } from '@/src/lib/firebase/authService';
import { escutarLembretesAtivos, concluirLembrete } from '@/src/lib/firebase/lembreteService';

function MainContent() {
  const { user, userData, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filterSectorId, setFilterSectorId] = useState('all');
  const [filterChannel, setFilterChannel] = useState<{ type: 'all' | 'whatsapp' | 'instagram'; brand?: string }>({ type: 'all' });
  const [lembretesPop, setLembretesPop] = useState<any[]>([]);
  const [showAgenda, setShowAgenda] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'campaigns' | 'playground' | 'team'>('chat');

  useEffect(() => {
    // Segurança Adicional: Se um agente estiver em uma visão restrita, volta para o chat
    if (userData && userData.papel !== 'admin') {
      if (['playground', 'team'].includes(activeView)) {
        setActiveView('chat');
      }
    }
  }, [userData, activeView]);

  useEffect(() => {
    if (authLoading) return;
    
    testarConexao();

    // Se estiver logado mas sem perfil, cria um (apenas para facilitar demonstração inicial)
    if (user && !userData) {
      ensureUsuarioDocument(user);
    }

    if (user && userData) {
      // Inicia o Worker de Triagem Automática (IA) - Apenas admins ou sistema rodaria isso, mas deixamos aqui por enquanto
      const unsubscribeWorker = iniciarMonitoramentoTriagem();

      // Escuta apenas os chats da carteira do usuário (RBAC)
      const unsubscribeChats = escutarChatsCarteira(userData, (novosChats) => {
        setChats(novosChats);
        setCarregando(false);
      });

      // Escuta Lembretes em Real-time para Pop-ups
      const unsubscribeLembretes = escutarLembretesAtivos(userData.id, (novosLembretes) => {
        setLembretesPop(novosLembretes);
      });

      return () => {
        unsubscribeWorker();
        unsubscribeChats();
        unsubscribeLembretes();
      };
    }
  }, [user, userData, authLoading]);

  // Memórias para as listas filtradas
  const filteredChats = useMemo(() => {
    let list = chats;
    
    // Filtro por Setor
    if (filterSectorId !== 'all') {
      list = list.filter(c => c.setorId === filterSectorId);
    }
    
    // Filtro por Canal
    if (filterChannel.type !== 'all') {
      list = list.filter(c => c.canal === filterChannel.type);
      
      // Filtro por Marca (Instagram)
      if (filterChannel.type === 'instagram' && filterChannel.brand) {
        list = list.filter(c => c.origemId === filterChannel.brand);
      }
    }
    
    return list;
  }, [chats, filterSectorId, filterChannel]);

  const selectedChat = useMemo(() => 
    chats.find(c => c.id === selectedChatId) || null
  , [chats, selectedChatId]);

  const triageCount = useMemo(() => 
    chats.filter(c => c.setorId === 'triagem-id').length
  , [chats]);

  const unansweredCount = useMemo(() => 
    chats.filter(c => !!c.semRespostaDesde).length
  , [chats]);

  const handleSimularNovoChat = async () => {
    if (!userData) return;
    const chatId = await criarNovoChat({
      clienteNome: `Vendas ${Math.floor(Math.random() * 1000)}`,
      clienteTelefone: '5511999999999',
      canal: 'whatsapp',
      setorId: userData.setorId,
      origem: 'Google Ads'
    });
    
    if (chatId) {
      setTimeout(() => {
        salvarMensagem(chatId, 'cliente', 'Olá, ví o anúncio e quero saber mais sobre as matrículas.');
      }, 1000);
    }
  };

  const handleSimularMensagemFinanceira = async () => {
    const chatId = await criarNovoChat({
      clienteNome: `Cliente ${Math.floor(Math.random() * 1000)}`,
      clienteTelefone: '5511888888888',
      canal: 'whatsapp',
      setorId: 'triagem-id',
      origem: 'Direto'
    });
    
    if (chatId) {
      setTimeout(() => {
        salvarMensagem(chatId, 'cliente', 'Preciso do meu boleto para pagar hoje.');
      }, 1000);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 animate-pulse">Sincronizando Omni...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <TelaLogin />;
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Principal de Navegação (Ícones) */}
      <aside className="w-16 bg-slate-900 text-white flex flex-col items-center py-6 gap-6 z-30">
        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-500/20 cursor-pointer">
          <MessageSquare size={22} />
        </div>
        <MainNavItem 
          active={activeView === 'chat'} 
          onClick={() => { setActiveView('chat'); setShowAgenda(false); }}
        >
          <Users size={20} />
        </MainNavItem>
        <MainNavItem 
          active={activeView === 'campaigns'} 
          onClick={() => { setActiveView('campaigns'); setShowAgenda(false); }}
        >
          <Megaphone size={20} />
        </MainNavItem>

        {userData?.papel === 'admin' && (
          <>
            <MainNavItem 
              active={activeView === 'playground'} 
              onClick={() => { setActiveView('playground'); setShowAgenda(false); }}
            >
              <Terminal size={20} />
            </MainNavItem>
            <MainNavItem 
              active={activeView === 'team'} 
              onClick={() => { setActiveView('team'); setShowAgenda(false); }}
            >
              <Shield size={20} />
            </MainNavItem>
          </>
        )}

        <MainNavItem 
          onClick={() => setShowAgenda(!showAgenda)} 
          active={showAgenda}
        >
          <CalendarDays size={20} />
        </MainNavItem>
        <MainNavItem><Bell size={20} /></MainNavItem>
        <div className="mt-auto">
          <MainNavItem onClick={logout}><LogOut size={20} /></MainNavItem>
        </div>
      </aside>

      {/* Main Content Area */}
      {activeView === 'campaigns' ? (
        <section className="flex-1 bg-white">
          <PainelCampanhas />
        </section>
      ) : activeView === 'playground' ? (
        <section className="flex-1 bg-slate-50 overflow-y-auto">
          <PlaygroundSimulacao />
        </section>
      ) : activeView === 'team' ? (
        <section className="flex-1 bg-slate-50 overflow-y-auto">
          <GerenciamentoEquipe />
        </section>
      ) : (
        <>
          {/* 2nd Sidebar: Setores ou Agenda */}
          {showAgenda ? (
            <aside className="w-80 border-r border-slate-200 z-20">
              <AgendaVendedor atendenteId={userData?.id || ""} />
            </aside>
          ) : (
            <BarraLateralSetores 
              selectedSectorId={filterSectorId}
              onSelectSector={setFilterSectorId}
              selectedChannel={filterChannel}
              onSelectChannel={setFilterChannel}
              unansweredCount={unansweredCount}
              triageCount={triageCount}
            />
          )}

          {/* Popups de Notificação */}
          <NotificacaoMSN 
            lembretes={lembretesPop} 
            onClose={concluirLembrete}
            onAction={setSelectedChatId}
          />

          {/* Lista de Conversas (Colunada) */}
          <section className="w-96 border-r border-slate-200 bg-white flex flex-col shadow-xl z-10">
            <header className="p-6 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-black tracking-tight text-slate-800">Inbox</h1>
                <div className="flex gap-2">
                   <button 
                    onClick={handleSimularMensagemFinanceira}
                    className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                  >
                    <Bell size={18} />
                  </button>
                  <button 
                    onClick={handleSimularNovoChat}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              
              <div className="relative group">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="Filtrar por nome ou tag..." 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
            </header>

            <ListaDeConversas 
              chats={filteredChats}
              selectedChatId={selectedChatId}
              onSelectChat={setSelectedChatId}
              isLoading={carregando}
            />
          </section>

          {/* Área Central: Visualizador do Chat */}
          <main className="flex-1 flex overflow-hidden">
            {selectedChat ? (
              <div className="flex-1 flex overflow-hidden">
                <VisualizadorChat 
                  chat={selectedChat}
                  currentUserId={userData?.id || ""}
                  isAdmin={userData?.papel === 'admin'} 
                />
                <PainelLateralCliente chat={selectedChat} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white/50">
                <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-slate-200">
                  <MessageSquare size={40} className="text-indigo-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Central Omnichannel</h2>
                <p className="text-slate-400 max-w-xs text-[11px] font-bold uppercase tracking-[0.2em] leading-loose">
                  Selecione uma conversa ao lado para iniciar o atendimento integrado.
                </p>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

function MainNavItem({ children, active = false, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`p-3 rounded-2xl transition-all ${
        active ? 'bg-indigo-500/10 text-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'text-slate-500 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}
