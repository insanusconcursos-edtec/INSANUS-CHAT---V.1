/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
import { buscarChatPorContato, salvarMensagem, criarNovoChat } from "../src/lib/firebase/services";

/**
 * Handler definitivo para Webhook da Meta e APIs do sistema na Vercel
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query, body, url } = req;
  const path = url || '';

  // 1. HANDSHAKE DE VALIDAÇÃO (GET)
  if (method === 'GET') {
    // Rota do Webhook da Meta
    if (path.includes('/api/webhooks/meta') || path.includes('hub.mode')) {
      const mode = query['hub.mode'];
      const token = query['hub.verify_token'];
      const challenge = query['hub.challenge'];

      if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log('✅ WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }
    return res.status(200).send('API is Live');
  }

  // 2. PROCESSAMENTO DE EVENTOS E APIS (POST)
  if (method === 'POST') {
    // --- ROTA: WEBHOOK META ---
    if (path.includes('/api/webhooks/meta') || body.object) {
      try {
        const bodyValue = body;
        
        // WhatsApp
        if (bodyValue.object === "whatsapp_business_account") {
          for (const entry of bodyValue.entry || []) {
            for (const change of entry.changes || []) {
              if (change.value.messages) {
                for (const msg of change.value.messages) {
                  const contato = msg.from; 
                  const texto = msg.text?.body || (msg.type !== 'text' ? `[Mensagem do tipo ${msg.type}]` : "Mensagem vazia");
                  const nomeCliente = change.value.contacts?.[0]?.profile?.name || contato;

                  // Processamento assíncrono para retorno rápido para a Meta
                  processarEventoWhatsApp(contato, texto, nomeCliente).catch(e => 
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
            for (const msgObj of entry.messaging || []) {
              const senderId = msgObj.sender.id;
              const texto = msgObj.message?.text || "[Instagram Media]";
              
              processarEventoInstagram(senderId, texto).catch(e => 
                console.error("[Instagram Error]:", e)
              );
            }
          }
        }

        return res.status(200).send('EVENT_RECEIVED');
      } catch (error) {
        console.error("[Webhook Error]:", error);
        return res.status(200).send('ERROR_ACKNOWLEDGED');
      }
    }

    // --- ROTA: API CHAT (GEMINI) ---
    if (path.includes('/api/chat')) {
      try {
        const { texto, historico, sistemaPrompt } = body;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        const result = await ai.models.generateContent({
          model: "gemini-1.5-flash", 
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
      } catch (error) {
        console.error("Chat API error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }

    // --- ROTA: API TRIAGEM (GEMINI) ---
    if (path.includes('/api/triage')) {
      try {
        const { texto } = body;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: `Analise a seguinte mensagem de um cliente em uma plataforma CRM e categorize-a em um dos seguintes setores: "Comercial", "Financeiro" ou "Suporte Pedagógico".
          Mensagem: "${texto}"
          Responda obrigatoriamente no formato JSON: {"setor": "...", "justificativa": "...", "confianca": 0-1}`,
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
      } catch (error) {
        console.error("Triage error:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  return res.status(405).send('Method Not Allowed');
}

/**
 * Funções auxiliares para processamento assíncrono (melhora latência do webhook)
 */
async function processarEventoWhatsApp(contato: string, texto: string, nomeCliente: string) {
  let chat = await buscarChatPorContato(contato, 'whatsapp');
  let chatId = chat?.id;

  if (!chatId) {
    chatId = await criarNovoChat({
      clienteNome: nomeCliente,
      clienteTelefone: contato,
      canal: 'whatsapp',
      setorId: 'triagem-id',
      origem: 'Portal Meta'
    });
  }

  if (chatId) {
    await salvarMensagem(chatId, 'cliente', texto);
    console.log(`[WhatsApp Success] Msg de ${contato} processada.`);
  }
}

async function processarEventoInstagram(senderId: string, texto: string) {
  let chat = await buscarChatPorContato(senderId, 'instagram');
  let chatId = chat?.id;

  if (!chatId) {
    chatId = await criarNovoChat({
      clienteNome: `IG User ${senderId.slice(-4)}`,
      clienteTelefone: senderId,
      canal: 'instagram',
      setorId: 'triagem-id',
      origem: 'IG Direct'
    });
  }

  if (chatId) {
    await salvarMensagem(chatId, 'cliente', texto);
    console.log(`[Instagram Success] Msg de ${senderId} processada.`);
  }
}
