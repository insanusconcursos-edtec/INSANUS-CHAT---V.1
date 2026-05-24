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

    // LOG DO PAYLOAD COMPLETO DA META
    console.log('WEBHOOK PAYLOAD META:', JSON.stringify(body, null, 2));

    try {
      // --- ROTA: WEBHOOK META (WhatsApp / Instagram) ---
      if (path.includes('/api/webhooks/meta') || body.object) {
        const bodyValue = body;
        
        // --- MAPEAMENTO MULTICANAL ---
        const getMetaToken = (id: string) => {
          // Insanus (WhatsApp, Page ID ou Instagram ID)
          const idInsanus = [getEnv('META_PAGE_ID_INSANUS'), getEnv('META_INSTAGRAM_ID_INSANUS'), '17841448523782454'];
          if (idInsanus.includes(id)) {
            return getEnv('META_TOKEN_INSANUS');
          }
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
                
                console.log(`[WhatsApp Payload] PhoneID: ${phoneId}, Token found: ${token ? 'YES' : 'NO'}`);

                for (const msg of change.value.messages) {
                  const contato = msg.from; 
                  const texto = msg.text?.body || (msg.type !== 'text' ? `[Mensagem do tipo ${msg.type}]` : "Mensagem vazia");
                  const nomeCliente = change.value.contacts?.[0]?.profile?.name || contato;

                  console.log(`[WhatsApp] Processando mensagem de ${contato} síncronamente...`);
                  await processarEventoWhatsApp(contato, texto, nomeCliente, phoneId, token).catch(e => 
                    console.error("[WhatsApp Error]:", e)
                  );
                }
              }
            }
          }
          console.log("[WhatsApp] Evento processado com sucesso. Enviando 200 OK.");
          return res.status(200).send('EVENT_RECEIVED');
        }

        // Instagram
        if (bodyValue.object === "instagram") {
          for (const entry of bodyValue.entry || []) {
            const pageId = entry.id; // ID da conta Instagram/Página Facebook
            const token = getMetaToken(pageId);
            
            console.log(`[Instagram Payload] PageID: ${pageId}, Token found: ${token ? 'YES' : 'NO'}`);

            for (const msgObj of entry.messaging || []) {
              const senderId = msgObj.sender?.id;
              const recipientId = msgObj.recipient?.id;
              
              if (!senderId) {
                console.warn("[Instagram Warning] Mensagem sem senderId, ignorando.", msgObj);
                continue;
              }

              const texto = msgObj.message?.text || "[Instagram Media/Interaction]";
              
              console.log(`[Instagram] Processando mensagem de ${senderId} síncronamente...`);

              await processarEventoInstagram(senderId, texto, pageId, token).catch(e => 
                console.error("[Instagram Error]:", e)
              );
            }
          }
          console.log("[Instagram] Evento processado com sucesso. Enviando 200 OK.");
          return res.status(200).send('EVENT_RECEIVED');
        }
      }

      // --- ROTA: API CHAT (GEMINI) ---
      if (path.includes('/api/chat')) {
        const { GoogleGenAI } = await import("@google/genai");
        const { texto, historico, sistemaPrompt, chatId } = body;

        // Idempotência: Se chatId for provido, verifica status no Firestore para evitar duplicidade
        if (chatId) {
          try {
            const { getDoc, doc } = await import("firebase/firestore");
            const { db } = await import("../src/lib/firebase/config.js");
            const chatSnap = await getDoc(doc(db, 'chats', chatId));
            if (chatSnap.exists()) {
              const data = chatSnap.data();
              // Se já foi respondido ou está em processamento avançado, interrompe
              if (data.iaStatus === 'respondido' || data.iaStatus === 'processando') {
                console.log(`[API Chat] Chat ${chatId} já foi respondido ou está em processamento. Ignorando requisição duplicada.`);
                return res.json({ resposta: "" });
              }
            }
          } catch (e) {
            console.error("[API Chat] Erro ao verificar idempotência:", e);
          }
        }

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
  try {
    const { buscarChatPorContato, salvarMensagem, criarNovoChat } = await import("../src/lib/firebase/services.js");
    
    console.log(`[WhatsApp Debug] Buscando chat para contato: ${contato}`);
    let chat = await buscarChatPorContato(contato, 'whatsapp');
    let chatId = chat?.id;

    if (!chatId) {
      console.log(`[WhatsApp Debug] Chat não encontrado. Criando novo chat para: ${contato}`);
      chatId = await criarNovoChat({
        clienteNome: nomeCliente,
        clienteTelefone: contato,
        canal: 'whatsapp',
        setorId: 'triagem-id',
        origem: 'Portal Meta',
        origemId: phoneId // Guardamos o ID do canal para resposta posterior
      });
      console.log(`[WhatsApp Debug] Novo chat criado. ID: ${chatId}`);
    }

    if (chatId) {
      console.log(`[WhatsApp Debug] A TENTAR GUARDAR MENSAGEM NO FIRESTORE (ChatID: ${chatId})...`);
      await salvarMensagem(chatId, 'cliente', texto);
      console.log(`[WhatsApp Debug] ✅ GUARDADO COM SUCESSO. ChatID: ${chatId}`);
      console.log(`[WhatsApp Success] Msg de ${contato} processada (Canal: ${phoneId}).`);
    } else {
      console.warn(`[WhatsApp Warning] Não foi possível encontrar ou criar chat para ${contato}`);
    }
  } catch (error) {
    console.error('ERRO AO SALVAR WHATSAPP NO FIRESTORE:', error);
    throw error;
  }
}

async function processarEventoInstagram(senderId: string, texto: string, pageId: string | undefined, token: string | undefined) {
  try {
    const { buscarChatPorContato, salvarMensagem, criarNovoChat } = await import("../src/lib/firebase/services.js");
    const { doc, updateDoc } = await import("firebase/firestore");
    const { db } = await import("../src/lib/firebase/config.js");

    console.log(`[Instagram Debug] Início do processamento para ${senderId}`);

    // d) fetch na Graph API (Perfil)
    let nomeCliente = `IG User ${senderId.slice(-4)}`;
    let fotoCliente = '';

    if (token) {
      try {
        console.log(`[Instagram Debug] a) Fetching profile real na Graph API v25.0...`);
        const profileRes = await fetch(`https://graph.facebook.com/v25.0/${senderId}?fields=name,profile_pic&access_token=${token}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.name) nomeCliente = profileData.name;
          if (profileData.profile_pic) fotoCliente = profileData.profile_pic;
          console.log(`[Instagram Debug] Perfil encontrado: ${nomeCliente}`);
        } else {
          console.warn(`[Instagram Debug] Falha ao buscar perfil (Graph API): ${profileRes.status}`);
        }
      } catch (e) {
        console.error('[Instagram Profile Error]', e);
      }
    }

    // b) busca do chat no Firestore
    console.log(`[Instagram Debug] b) Buscando chat no Firestore...`);
    let chat = null;
    try {
      chat = await buscarChatPorContato(senderId, 'instagram');
      console.log(`[Instagram Debug] Resultado busca chat: ${chat ? 'Encontrado ' + chat.id : 'Não encontrado'}`);
    } catch (searchError) {
      console.error("[Instagram Debug] Erro ao buscar chat:", searchError);
    }

    let chatId = chat?.id;

    // c) criação ou atualização e gravação da mensagem
    if (!chatId) {
      console.log(`[Instagram Debug] c) Criando novo chat...`);
      chatId = await criarNovoChat({
        clienteNome: nomeCliente,
        clienteTelefone: senderId,
        canal: 'instagram',
        setorId: 'triagem-id',
        origem: 'IG Direct',
        origemId: pageId, 
        clienteFoto: fotoCliente
      });
      console.log(`[Instagram Debug] Novo chat criado: ${chatId}`);
    } else if (nomeCliente !== chat.clienteNome && !nomeCliente.startsWith('IG User')) {
      console.log(`[Instagram Debug] c) Atualizando dados do cliente...`);
      try {
        await updateDoc(doc(db, 'chats', chatId), {
          clienteNome: nomeCliente,
          clienteFoto: fotoCliente
        });
        console.log(`[Instagram Debug] Firebase atualizado para: ${nomeCliente}`);
      } catch (e) {
        console.warn(`[Instagram Debug] Falha ao atualizar dados:`, e);
      }
    }

    if (chatId) {
      console.log(`[Instagram Debug] c) Gravando mensagem no Firestore...`);
      await salvarMensagem(chatId, 'cliente', texto);
      console.log(`[Instagram Debug] ✅ MENSAGEM GUARDADA COM SUCESSO. ChatID: ${chatId}`);
    } else {
      console.warn(`[Instagram Warning] Falha ao obter ChatID.`);
    }
  } catch (error) {
    console.error('ERRO CRÍTICO NO PROCESSAMENTO INSTAGRAM:', error);
  }
}

