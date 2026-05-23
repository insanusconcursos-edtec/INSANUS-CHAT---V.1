/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Terminal, 
  Send, 
  UserPlus, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Smartphone,
  Instagram,
  RefreshCw
} from 'lucide-react';

export default function PlaygroundSimulacao() {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('55119' + Math.floor(10000000 + Math.random() * 90000000));
  const [mensagem, setMensagem] = useState('');
  const [canal, setCanal] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const simularMensagem = async () => {
    if (!mensagem || !nome) {
      setStatus({ type: 'error', text: 'Preencha nome e mensagem para simular.' });
      return;
    }

    setCarregando(true);
    setStatus(null);

    try {
      // Mock da estrutura da Meta
      const payload = canal === 'whatsapp' ? {
        object: "whatsapp_business_account",
        entry: [{
          changes: [{
            value: {
              contacts: [{ profile: { name: nome } }],
              messages: [{
                from: telefone,
                text: { body: mensagem },
                type: "text",
                id: `wamid.${Math.random().toString(36).substr(2, 10)}`
              }]
            }
          }]
        }]
      } : {
        object: "instagram",
        entry: [{
          messaging: [{
            sender: { id: telefone },
            message: { text: mensagem }
          }]
        }]
      };

      const response = await fetch('/api/webhooks/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setStatus({ type: 'success', text: 'Evento enviado! Verifique o painel de Inbox.' });
        setMensagem('');
      } else {
        throw new Error('Falha ao processar webhook simulation');
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', text: 'Erro na simulação. Verifique os logs do servidor.' });
    } finally {
      setCarregando(false);
    }
  };

  const autoFill = (msg: string) => {
    setMensagem(msg);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-slate-200">
          <Terminal size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Simulador de Tráfego</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2 italic">
          Homologação de Webhooks & Inteligência Artificial
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Painel de Controle */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
          <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tight">
            <UserPlus className="text-indigo-600" size={20} /> Entrada de Lead
          </h2>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Lead</label>
              <input 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone / ID Externo</label>
              <input 
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Canal de Origem</label>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCanal('whatsapp')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${
                    canal === 'whatsapp' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  <Smartphone size={14} /> WhatsApp
                </button>
                <button 
                  onClick={() => setCanal('instagram')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${
                    canal === 'instagram' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  <Instagram size={14} /> Instagram
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mensagem do Cliente</label>
              <textarea 
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                placeholder="O que o cliente está dizendo?"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white outline-none transition-all resize-none"
              />
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
              onClick={simularMensagem}
              disabled={carregando}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {carregando ? <RefreshCw size={20} className="animate-spin" /> : <><Zap size={20} className="fill-current" /> Disparar Evento</>}
            </button>
          </div>
        </div>

        {/* Templates e Logs */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-slate-500">Templates Sugeridos</h2>
            <div className="space-y-3">
              {[
                { title: "Interesse em Curso (Vendas)", msg: "Olá! Vi o anúncio no Insta. Qual o valor do curso completo para a Guarda Municipal?" },
                { title: "Dúvida de Pagamento (Financeiro)", msg: "Preciso de um novo boleto, o meu venceu ontem e não consigo pagar." },
                { title: "Suporte (Pedagógico)", msg: "Não estou conseguindo acessar a aula 04 do módulo de Direito Constitucional." },
              ].map((tmpl, idx) => (
                <button 
                  key={idx}
                  onClick={() => { setNome(tmpl.title.split('(')[0].trim()); autoFill(tmpl.msg); }}
                  className="w-full text-left p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                >
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">{tmpl.title}</p>
                  <p className="text-xs text-slate-300 font-medium group-hover:text-white line-clamp-1">{tmpl.msg}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4">O que será validado?</h2>
            <ul className="space-y-4">
              {[
                "Processamento do Webhook via Express",
                "Criação automática de Chat e Lead",
                "Triagem IA (Setorização Automática)",
                "Resposta Humanizada do Agente Virtual",
                "Alerta em Tempo Real no Painel Inbox"
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-tighter opacity-90">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{idx + 1}</div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
