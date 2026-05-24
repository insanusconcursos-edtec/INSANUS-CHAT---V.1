/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Serviço isolado para comunicação com as APIs oficiais da Meta (WhatsApp e Instagram).
 */

/**
 * Helper para obter o token correto baseado no ID da conta (multi-tenant)
 */
function getMetaToken(id: string | undefined): string {
  const tokenInsanus = process.env.META_TOKEN_INSANUS;
  const pageIdInsanus = process.env.META_PAGE_ID_INSANUS;
  const igIdInsanus = process.env.META_INSTAGRAM_ID_INSANUS || '17841448523782454';

  if (id && (id === pageIdInsanus || id === igIdInsanus)) {
    return tokenInsanus || process.env.META_ACCESS_TOKEN || '';
  }
  
  // Fallbacks para outros inquilinos se necessário
  if (id === process.env.META_PAGE_ID_GABARITO) return process.env.META_TOKEN_GABARITO || '';
  if (id === process.env.META_PAGE_ID_ENEM) return process.env.META_TOKEN_ENEM || '';

  return process.env.META_ACCESS_TOKEN || '';
}

/**
 * Envia uma mensagem via WhatsApp Business API
 */
export async function enviarMensagemWhatsApp(to: string, text: string, phoneId?: string) {
  const token = getMetaToken(phoneId);
  const activePhoneId = phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !activePhoneId) {
    console.warn('[Meta API] Credenciais do WhatsApp não configuradas.');
    return null;
  }

  const url = `https://graph.facebook.com/v21.0/${activePhoneId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
export async function enviarMensagemInstagram(recipientId: string, text: string, igAccountId?: string) {
  const token = getMetaToken(igAccountId);
  // Se igAccountId não for provido, tenta usar 'me' (comportamento antigo) ou fallback
  const accountId = igAccountId || 'me';

  if (!token) {
    console.warn('[Meta API] Access Token da Meta não configurado.');
    return null;
  }

  // Ajustado para v21.0 (ou v25.0 conforme solicitado, usando a mais estável disponível no momento do SDK se possível)
  // O usuário pediu especificamente v25.0
  const url = `https://graph.facebook.com/v25.0/${accountId}/messages`;

  try {
    console.log(`[Meta API] Enviando Instagram POST para ${url} (Token: ${token.slice(0, 5)}...)`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
export async function enviarMensagemPeloCanal(contato: string, texto: string, canal: 'whatsapp' | 'instagram' | 'telegram' | 'web', origemId?: string) {
  console.log(`[Meta API] Despachando via ${canal} para ${contato} (Origem: ${origemId})`);
  
  switch (canal) {
    case 'whatsapp':
      return await enviarMensagemWhatsApp(contato, texto, origemId);
    case 'instagram':
      return await enviarMensagemInstagram(contato, texto, origemId);
    default:
      console.log(`[Meta API] Canal ${canal} não requer API da Meta ou não suportado.`);
      return { status: 'ignored' };
  }
}
