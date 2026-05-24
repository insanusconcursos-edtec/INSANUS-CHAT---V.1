/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { buscarChatPorContato, salvarMensagem, criarNovoChat } from "./src/lib/firebase/services.js";
import { iniciarMonitoramentoSaidaMeta } from "./src/lib/meta/metaWorker.js";

dotenv.config();

const app = express();
const PORT = 3000;

/**
 * Helper isomorfo para leitura de variáveis de ambiente
 */
const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key] as string;
    }
  } catch (e) {}
  return '';
};

async function setupServer() {
  // Inicia workers de segundo plano
  iniciarMonitoramentoSaidaMeta();

  app.use(express.json());

  // Initialize Gemini
  const ai = new GoogleGenAI({ 
    apiKey: getEnv('GEMINI_API_KEY'),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { texto, historico, sistemaPrompt } = req.body;

      if (!texto) {
        return res.status(400).json({ error: "Texto is required" });
      }

      // In @google/genai v2+, we use generateContent with system instruction in model config
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash", 
        config: {
          systemInstruction: sistemaPrompt,
        },
        contents: [
          ...(historico || []).map((h: any) => ({ 
            role: h.remetente === 'cliente' ? 'user' : 'model', 
            parts: [{ text: h.texto }] 
          })),
          { role: 'user', parts: [{ text: texto }] }
        ]
      });

      const responseText = result.text || "";

      res.json({ resposta: responseText });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(500).json({ error: "Internal server error during chat generation" });
    }
  });

  app.post("/api/triage", async (req, res) => {
    try {
      const { texto } = req.body;

      if (!texto) {
        return res.status(400).json({ error: "Texto is required" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Analise a seguinte mensagem de um cliente em uma plataforma CRM e categorize-a em um dos seguintes setores: "Comercial" (vendas, preços, interesse), "Financeiro" (pagamentos, boletos, reembolsos) ou "Suporte Pedagógico" (dúvidas sobre cursos, acesso, conteúdo).
        
        Mensagem: "${texto}"
        
        Responda obrigatoriamente no formato JSON:
        {
          "setor": "Comercial" | "Financeiro" | "Suporte Pedagógico",
          "justificativa": "breve explicação",
          "confianca": 0 a 1
        }`,
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

      const triageResult = JSON.parse(response.text || "{}");
      res.json(triageResult);
    } catch (error) {
      console.error("Triage error:", error);
      res.status(500).json({ error: "Internal server error during triage" });
    }
  });

  // Webhooks da Meta (WhatsApp e Instagram)
  app.get("/api/webhooks/meta", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === getEnv('META_VERIFY_TOKEN')) {
        console.log("[Webhook Meta] Verificado com sucesso!");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  });

  app.post("/api/webhooks/meta", async (req, res) => {
    try {
      const body = req.body;
      
      // WhatsApp Events
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry || []) {
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
                  console.log(`[Webhook Meta] Sucesso: Mensagem de ${contato} processada no chat ${chatId}`);
                }
              }
            }
          }
        }
      }

      // Instagram Events
      if (body.object === "instagram") {
        for (const entry of body.entry || []) {
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
              console.log(`[Webhook IG] Sucesso: Mensagem de ${senderId} processada.`);
            }
          }
        }
      }

      res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      console.error("[Webhook Meta Error]:", error);
      res.status(200).send("ERROR_BUT_ACKNOWLEDGED"); // Meta expects 200 often to stop retrying if it's our logic error
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Local listen only if not on Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

setupServer();

export default app;
