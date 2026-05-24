/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
import { buscarChatPorContato, salvarMensagem, criarNovoChat } from "../src/lib/firebase/services";

/**
 * Handler do Webhook da Meta para Vercel Serverless
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query, body, url } = req;
  const path = url || '';

  // Initialize Gemini
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || '',
  });

  // 1. Validação do Webhook (GET)
  if (method === 'GET') {
    if (path.includes('/api/webhooks/meta')) {
      const mode = query['hub.mode'];
      const token = query['hub.verify_token'];
      const challenge = query['hub.challenge'];

      if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log("[Webhook Meta] Verificação OK.");
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }
    return res.status(404).send('Not Found');
  }

  // 2. Recebimento de Eventos e APIs (POST)
  if (method === 'POST') {
    // API Chat
    if (path.includes('/api/chat')) {
      try {
        const { texto, historico, sistemaPrompt } = body;
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

    // API Triage
    if (path.includes('/api/triage')) {
      try {
        const { texto } = body;
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

    // Webhook Meta
    if (path.includes('/api/webhooks/meta')) {
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
                    console.log(`[Webhook Meta] Msg de ${contato} -> chat ${chatId}`);
                  }
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
              }
            }
          }
        }

        return res.status(200).send('EVENT_RECEIVED');
      } catch (error) {
        console.error("[Webhook Error]:", error);
        return res.status(200).send('ERROR_ACKNOWLEDGED');
      }
    }
    return res.status(404).send('Not Found');
  }

  // Fallback para outros métodos ou rotas se necessário
  return res.status(405).send('Method Not Allowed');
}
