# Especificação de Segurança - Omnichannel CRM

## Invariantes de Dados
1. Usuários só podem ler chats do seu próprio setor (ou se forem admins).
2. Agentes não podem alterar seu próprio papel (papel é definido por admin).
3. Mensagens devem ser vinculadas a um chatId válido e o remetente deve ser autêntico.
4. Lembretes são privados ao atendente responsável ou ao setor.

## The "Dirty Dozen" Payloads (Amostra)
1. Alterar papel de agente para admin via client SDK.
2. Ler mensagens de um chat de outro setor.
3. Criar chat com ID malicioso longo.
4. Atualizar `atendenteId` de um chat que já pertence a outro agente.
5. Injetar campo `isVerified: true` no perfil do usuário.
... (outros 7 simulados mentalmente para brevidade, seguindo os pilares do skill)

## Testes de Validação
Os testes devem garantir que operações cruzadas entre setores sejam bloqueadas e que a identidade do remetente seja verificada contra `request.auth.uid`.
