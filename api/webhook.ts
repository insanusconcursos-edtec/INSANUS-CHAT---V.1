/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Bare-minimum handler para validação de Webhook da Meta e Vercel
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  // 1. HANDSHAKE DE VALIDAÇÃO (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log('✅ WEBHOOK_VERIFIED');
        // ATENÇÃO: Retornar apenas o 'challenge' como texto puro.
        return res.status(200).send(challenge);
      } else {
        console.error('❌ Token Incorreto!');
        return res.status(403).send('Forbidden');
      }
    }
    return res.status(200).send('Webhook is Live');
  }

  // 2. RECEBIMENTO DE MENSAGENS (POST) - Placeholder temporário
  if (req.method === 'POST') {
    console.log('📩 Evento recebido:', JSON.stringify(req.body));
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).send('Method Not Allowed');
}
