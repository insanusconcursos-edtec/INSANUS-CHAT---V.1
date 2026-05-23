/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Serviço isolado para comunicação com as APIs oficiais da Meta (WhatsApp e Instagram).
 */

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Envia uma mensagem via WhatsApp Business API
 */
export async function enviarMensagemWhatsApp(to: string, text: string) {
  if (!META_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[Meta API] Credenciais do WhatsApp não configuradas.');
    return null;
  }

  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: text }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Meta API] Erro ao enviar WhatsApp:', data);
      throw new Error(data.error?.message || 'Falha ao enviar mensagem no WhatsApp');
    }

    return data;
  } catch (error) {
    console.error('[Meta API] Exception no envio WhatsApp:', error);
    throw error;
  }
}

/**
 * Envia uma mensagem via Instagram Graph API
 */
export async function enviarMensagemInstagram(recipientId: string, text: string) {
  if (!META_ACCESS_TOKEN) {
    console.warn('[Meta API] Access Token da Meta não configurado.');
    return null;
  }

  const url = `https://graph.facebook.com/v19.0/me/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Meta API] Erro ao enviar Instagram:', data);
      throw new Error(data.error?.message || 'Falha ao enviar mensagem no Instagram');
    }

    return data;
  } catch (error) {
    console.error('[Meta API] Exception no envio Instagram:', error);
    throw error;
  }
}

/**
 * Função genérica para despachar mensagens baseada no canal
 */
export async function enviarMensagemPeloCanal(contato: string, texto: string, canal: 'whatsapp' | 'instagram' | 'telegram' | 'web') {
  console.log(`[Meta API] Despachando via ${canal} para ${contato}`);
  
  switch (canal) {
    case 'whatsapp':
      return await enviarMensagemWhatsApp(contato, texto);
    case 'instagram':
      return await enviarMensagemInstagram(contato, texto);
    default:
      console.log(`[Meta API] Canal ${canal} não requer API da Meta ou não suportado.`);
      return { status: 'ignored' };
  }
}
