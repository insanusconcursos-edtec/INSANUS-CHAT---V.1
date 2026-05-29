/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { collection, getDocs, doc, updateDoc, arrayUnion, query, where, serverTimestamp, addDoc, arrayRemove } from "firebase/firestore";
import { db } from "./src/lib/firebase/config.js";
import { SYSTEM_PROMPT_VENDAS } from "./src/lib/firebase/iaPromptVendas.js";
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
      const { chatId, texto, historico } = req.body;
      const sistemaPromptOverride = SYSTEM_PROMPT_VENDAS;

      if (!texto) {
        return res.status(400).json({ error: "Texto is required" });
      }

      // Buscar catalogo de vendas
      let catalogoTexto = "";
      try {
        const catalogoSnap = await getDocs(collection(db, 'catalogo_vendas'));
        let itens: any[] = [];
        catalogoSnap.forEach(doc => {
          itens.push({ id: doc.id, ...doc.data() });
        });
        
        if (itens.length > 0) {
          catalogoTexto = "\n\nCATÁLOGO DE PRODUTOS DISPONÍVEIS:\n" + itens.map(i => {
            let metaFields = `Modalidade: ${i.modalidade} | Status: ${i.status}`;
            if (i.modalidade === 'ONLINE' && i.categoria_online) {
              metaFields += ` | Categoria: ${i.categoria_online}`;
            }
            if (i.modalidade === 'PRESENCIAL' && i.localidade_presencial) {
              metaFields += ` | Localidade: ${i.localidade_presencial}`;
              if (i.data_inicio) metaFields += ` | Data de Início: ${i.data_inicio}`;
              if (i.quantidade_encontros) metaFields += ` | Aulas/Encontros: ${i.quantidade_encontros}`;
              if (i.valor_ancoragem) metaFields += ` | Valor Base: R$ ${i.valor_ancoragem}`;
              if (i.valor_desconto_credito) metaFields += ` | Desconto Crédito: R$ ${i.valor_desconto_credito}`;
              if (i.valor_desconto_pix) metaFields += ` | Desconto PIX: R$ ${i.valor_desconto_pix}`;
            }
            let str = `- ID: ${i.id} | Nome: ${i.nome} | ${metaFields}\n  Pitch: ${i.pitch}\n  Link Checkout: ${i.checkout || 'Nenhum'}`;
            if (i.url) str += `\n  Página de Vendas: ${i.url}`;
            return str;
          }).join("\n\n");

          catalogoTexto += "\n\nREGRAS DO CATÁLOGO E SEGMENTAÇÃO:\n";
          catalogoTexto += "1. Se um aluno perguntar por turmas presenciais e mencionar uma região (ex: Rondônia/Porto Velho ou Acre/Rio Branco), você DEVE buscar e oferecer APENAS os produtos com a respectiva 'Localidade'. Não ofereça turmas de outro estado.\n";
          catalogoTexto += "2. Se o cliente perguntar por um produto com Status 'EM PRODUÇÃO', responda de forma extremamente acolhedora e vendedora, gerando antecipação. NÃO envie link de checkout para este produto.\n";
          catalogoTexto += "3. Quando identificar interesse claro em um produto 'EM PRODUÇÃO', você DEVE adicionar ao final da sua resposta a tag exata: [TAG:interesse_ID_DO_PRODUTO] (onde ID_DO_PRODUTO é o ID real do catálogo).\n";
        } else {
          catalogoTexto = "\n\nCATÁLOGO DE PRODUTOS DISPONÍVEIS: ATENÇÃO! O catálogo está vazio neste momento. Temos zero produtos, turmas ou mentorias ativas.";
        }
      } catch (catErr) {
        console.error("Erro ao buscar catalogo", catErr);
        catalogoTexto = "\n\nCATÁLOGO DE PRODUTOS DISPONÍVEIS: ATENÇÃO! O catálogo está vazio ou inacessível. Temos zero produtos, turmas ou mentorias ativas.";
      }

      const finalPrompt = `${sistemaPromptOverride}${catalogoTexto}\n\nIMPORTANTE: Gere o texto EXCLUSIVAMENTE em plain text (texto puro). NÃO utilize formatação Markdown, NÃO coloque palavras em negrito com asteriscos (**), NÃO use itálico ou listas formatadas. Seu texto final DEVE ser curto e direto para caber em mensagens de Instagram Direct.`;

      console.log("[DEBUG /api/chat] Tamanho do catalogoTexto:", catalogoTexto.length);
      console.log("[DEBUG /api/chat] Final Prompt completo:\n", finalPrompt);

      const toolDeclaration = {
        functionDeclarations: [
          {
            name: "salvar_lead",
            description: "Registra os dados de contato do lead na lista de espera VIP de um curso que está com status 'EM PRODUÇÃO'.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                nome: { type: Type.STRING, description: "Nome completo do lead" },
                email: { type: Type.STRING, description: "E-mail do lead" },
                whatsapp: { type: Type.STRING, description: "WhatsApp/Contato com DDD" },
                produtoId: { type: Type.STRING, description: "ID do produto em desenvolvimento no catálogo" }
              },
              required: ["nome", "email", "whatsapp", "produtoId"]
            }
          }
        ]
      };

      const contents = [
        ...(historico || []).map((h: any) => ({ 
          role: h.remetente === 'cliente' ? 'user' : 'model', 
          parts: [{ text: h.texto }] 
        })),
        { role: 'user', parts: [{ text: texto }] }
      ];

      // In @google/genai v2+, we use generateContent with system instruction in model config
      let result = await ai.models.generateContent({
        model: "gemini-3.5-flash", 
        config: {
          systemInstruction: finalPrompt,
          temperature: 0.1,
          tools: [toolDeclaration]
        },
        contents: contents
      });

      if (result.functionCalls && result.functionCalls.length > 0) {
        const call = result.functionCalls[0];
        if (call.name === 'salvar_lead') {
          const args = call.args as any;
          console.log(`[FUNCTION CALL] Executando salvar_lead para ${args.nome}...`);
          let saveResult;
          try {
            await addDoc(collection(db, `catalogo_vendas/${args.produtoId}/leads_espera`), {
              nome: args.nome,
              email: args.email,
              whatsapp: args.whatsapp,
              status_notificacao: 'pendente',
              timestamp: new Date().toISOString()
            });
            saveResult = { status: "sucesso", message: "Lead registrado com sucesso." };
          } catch(err: any) {
            saveResult = { status: "erro", message: err.message };
          }

          contents.push({ role: "model", parts: [{ functionCall: call }] });
          contents.push({
            role: "user", 
            parts: [{
              functionResponse: {
                name: "salvar_lead",
                response: saveResult
              }
            }]
          });

          result = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            config: {
              systemInstruction: finalPrompt,
              temperature: 0.1,
              tools: [toolDeclaration]
            },
            contents: contents
          });
        }
      }

      let responseText = result.text || "";

      // Processa Tags ocultas
      const tagRegex = /\[TAG:(.*?)\]/g;
      let tagsEncontradas: string[] = [];
      let match;
      while ((match = tagRegex.exec(responseText)) !== null) {
        tagsEncontradas.push(match[1]);
      }
      responseText = responseText.replace(tagRegex, '').trim();

      if (tagsEncontradas.length > 0 && chatId) {
        try {
          await updateDoc(doc(db, 'chats', chatId), {
            tags: arrayUnion(...tagsEncontradas)
          });
          console.log(`[API Chat] Tags adicionadas ao chat ${chatId}:`, tagsEncontradas);
        } catch (tagErr) {
          console.error("Erro ao salvar tags", tagErr);
        }
      }

      // Remove markdown chars
      responseText = responseText.replace(/\*/g, '');

      res.json({ resposta: responseText });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(200).json({ error: "Internal server error during chat generation" });
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

  app.post("/api/reengajamento", async (req, res) => {
    try {
      const { produtoId, nomeProduto, linkCheckout } = req.body;
      
      const tagProcurada = `interesse_${produtoId}`;
      console.log(`[Reengajamento] Iniciando varredura para tag: ${tagProcurada}`);
      
      const q = query(collection(db, 'chats'), where("tags", "array-contains", tagProcurada));
      const querySnapshot = await getDocs(q);
      
      let disparos = 0;
      for (const chatDoc of querySnapshot.docs) {
        const chatData = chatDoc.data();
        const chatId = chatDoc.id;
        
        const mensagemReengajamento = `Olá! Tudo bem? Lembra que você me perguntou sobre o ${nomeProduto}? Ele acabou de sair do forno e as vagas da turma de elite foram liberadas! Aqui está o seu link: ${linkCheckout}\nCorra para garantir sua vaga!`;
        
        try {
          await addDoc(collection(db, `chats/${chatId}/mensagens`), {
            texto: mensagemReengajamento,
            remetente: 'ia',
            timestamp: serverTimestamp()
          });

          await updateDoc(doc(db, 'chats', chatId), {
            iaStatus: 'novo',
            updatedAt: serverTimestamp()
          });

          await updateDoc(doc(db, 'chats', chatId), {
            tags: arrayRemove(tagProcurada)
          });
          
          // O outbound_worker.ts/webhook.ts já farão o envio se o remetente for a IA para o canal correto
          // Simulando o outbound na view de log se necessário:
          if (chatData.clienteTelefone && chatData.origemId && chatData.canal === 'instagram') {
             console.log(`[Vendedor Ativo] Enviando outbound Meta para ${chatData.clienteTelefone}: ${mensagemReengajamento}`);
          }
          
          disparos++;
        } catch (err) {
          console.error(`Erro ao processar reengajamento para chat ${chatId}`, err);
        }
      }
      
      res.json({ message: "Reengajamento concluído", disparos });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro no reengajamento" });
    }
  });

  // Local listen only if not on Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

setupServer();

export default app;
