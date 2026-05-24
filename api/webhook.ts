/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Helper isomorfo para leitura de variáveis de ambiente
 */
const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key] as string;
    }
  } catch (e) {}
  return '';
};

/**
 * Handler Fail-Safe para Webhook da Meta e APIs do sistema na Vercel
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req;

  // 1. HANDSHAKE DE VALIDAÇÃO (GET) - PRIORIDADE MÁXIMA
  // Executado antes de qualquer inicialização pesada para evitar timeout na Meta
  if (method === 'GET') {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === getEnv('META_VERIFY_TOKEN')) {
      console.log('✅ WEBHOOK_VERIFIED');
      // Meta exige o challenge puro como texto
      return res.status(200).send(challenge);
    }

    // Apenas para verificação manual no navegador se o endpoint está ativo
    return res.status(200).send('API is Live and Ready for Handshake');
  }

  // 2. PROCESSAMENTO DE EVENTOS E APIS (POST)
  // Inicialização pesada ocorre apenas se a requisição for POST
  if (method === 'POST') {
    const { body, url } = req;
    const path = url || '';

    try {
      // --- ROTA: WEBHOOK META (WhatsApp / Instagram) ---
      if (path.includes('/api/webhooks/meta') || body.object) {
        const bodyValue = body;
        
        // --- MAPEAMENTO MULTICANAL ---
        const getMetaToken = (id: string) => {
          if (id === getEnv('META_PAGE_ID_INSANUS')) return getEnv('META_TOKEN_INSANUS');
          if (id === getEnv('META_PAGE_ID_GABARITO')) return getEnv('META_TOKEN_GABARITO');
          if (id === getEnv('META_PAGE_ID_ENEM')) return getEnv('META_TOKEN_ENEM');
          return getEnv('META_ACCESS_TOKEN'); // Fallback
        };

        // WhatsApp
        if (bodyValue.object === "whatsapp_business_account") {
          for (const entry of bodyValue.entry || []) {
            for (const change of entry.changes || []) {
              if (change.value.messages) {
                const phoneId = change.value.metadata?.phone_number_id;
                const token = getMetaToken(phoneId);

                for (const msg of change.value.messages) {
                  const contato = msg.from; 
                  const texto = msg.text?.body || (msg.type !== 'text' ? `[Mensagem do tipo ${msg.type}]` : "Mensagem vazia");
                  const nomeCliente = change.value.contacts?.[0]?.profile?.name || contato;

                  // Processamento assíncrono para retorno imediato
                  processarEventoWhatsApp(contato, texto, nomeCliente, phoneId, token).catch(e => 
                    console.error("[WhatsApp Error]:", e)
                  );
                }
              }
            }
          }
        }

        // Instagram
        if (bodyValue.object === "instagram") {
          for (const entry of bodyValue.entry || []) {
            const pageId = entry.id; // ID da conta Instagram/Página Facebook
            const token = getMetaToken(pageId);

            for (const msgObj of entry.messaging || []) {
              const senderId = msgObj.sender.id;
              const texto = msgObj.message?.text || "[Instagram Media]";
              
              processarEventoInstagram(senderId, texto, pageId, token).catch(e => 
                console.error("[Instagram Error]:", e)
              );
            }
          }
        }

        return res.status(200).send('EVENT_RECEIVED');
      }

      // --- ROTA: API CHAT (GEMINI) ---
      if (path.includes('/api/chat')) {
        const { GoogleGenAI } = await import("@google/genai");
        const { texto, historico, sistemaPrompt } = body;
        const ai = new GoogleGenAI({ 
          apiKey: getEnv('GEMINI_API_KEY'),
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        const result = await ai.models.generateContent({
          model: "gemini-3.5-flash", 
          config: { systemInstruction: sistemaPrompt },
          contents: [
            ...(historico || []).map((h: any) => ({ 
              role: h.remetente === 'cliente' ? 'user' : 'model', 
              parts: [{ text: h.texto }] 
            })),
            { role: 'user', parts: [{ text: texto }] }
          ]
        });
        return res.json({ resposta: result.text || "" });
      }

      // --- ROTA: API TRIAGEM (GEMINI) ---
      if (path.includes('/api/triage')) {
        const { GoogleGenAI, Type } = await import("@google/genai");
        const { texto } = body;
        const ai = new GoogleGenAI({ 
          apiKey: getEnv('GEMINI_API_KEY'),
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Analise a seguinte mensagem de um cliente em uma plataforma CRM e categorize-a em um dos seguintes setores: "Comercial", "Financeiro" ou "Suporte Pedagógico".\nMensagem: "${texto}"`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                setor: { type: Type.STRING },
                justificativa: { type: Type.STRING },
                confianca: { type: Type.NUMBER }
              },
              required: ["setor", "justificativa", "confianca"]
            }
          },
        });
        return res.json(JSON.parse(response.text || "{}"));
      }

    } catch (error) {
      console.error("[POST Handler Error]:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  return res.status(405).send('Method Not Allowed');
}

/**
 * Funções auxiliares com importações dinâmicas para isolar o Firebase
 */
async function processarEventoWhatsApp(contato: string, texto: string, nomeCliente: string, phoneId: string | undefined, token: string | undefined) {
  const { buscarChatPorContato, salvarMensagem, criarNovoChat } = await import("../src/lib/firebase/services");
  
  let chat = await buscarChatPorContato(contato, 'whatsapp');
  let chatId = chat?.id;

  if (!chatId) {
    chatId = await criarNovoChat({
      clienteNome: nomeCliente,
      clienteTelefone: contato,
      canal: 'whatsapp',
      setorId: 'triagem-id',
      origem: 'Portal Meta',
      origemId: phoneId // Guardamos o ID do canal para resposta posterior
    });
  }

  if (chatId) {
    // Aqui poderíamos salvar o token na sessão do chat se necessário, 
    // mas por agora garantimos que a mensagem é salva.
    await salvarMensagem(chatId, 'cliente', texto);
    console.log(`[WhatsApp Success] Msg de ${contato} processada (Canal: ${phoneId}).`);
  }
}

async function processarEventoInstagram(senderId: string, texto: string, pageId: string | undefined, token: string | undefined) {
  const { buscarChatPorContato, salvarMensagem, criarNovoChat } = await import("../src/lib/firebase/services");

  let chat = await buscarChatPorContato(senderId, 'instagram');
  let chatId = chat?.id;

  if (!chatId) {
    chatId = await criarNovoChat({
      clienteNome: `IG User ${senderId.slice(-4)}`,
      clienteTelefone: senderId,
      canal: 'instagram',
      setorId: 'triagem-id',
      origem: 'IG Direct',
      origemId: pageId // Guardamos o ID da conta Instagram
    });
  }

  if (chatId) {
    await salvarMensagem(chatId, 'cliente', texto);
    console.log(`[Instagram Success] Msg de ${senderId} processada (Canal: ${pageId}).`);
  }
}

