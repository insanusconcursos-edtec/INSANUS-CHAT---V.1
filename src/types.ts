/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PapelUsuario = 'admin' | 'agente';
export type StatusUsuario = 'online' | 'offline';
export type CanalAtendimento = 'whatsapp' | 'instagram' | 'messenger' | 'site';
export type EtapaFunil = 'novo' | 'negociacao' | 'aguardando_retorno' | 'fechado' | 'pos_venda';
export type RemetenteMensagem = 'cliente' | 'agente' | 'ia' | 'sistema';
export type PrioridadeLembrete = 'urgente' | 'atencao' | 'normal';
export type StatusLembrete = 'pendente' | 'concluido' | 'atrasado';
export type AntecedenciaLembrete = '5m' | '30m' | '1h' | '1d';

export interface Setor {
  id: string;
  nome: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  setorId: string;
  status: StatusUsuario;
}

export interface Chat {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  canal: CanalAtendimento;
  statusEtapa: EtapaFunil;
  atendenteId: string | null;
  setorId: string;
  dataUltimaMensagem: Date;
  semRespostaDesde: Date | null;
  origem: string;
  tags: string[];
  iaStatus?: 'pensando' | 'respondido' | 'erro';
  iaNote?: string;
  status?: 'aguardando_confirmacao' | 'em_atendimento' | 'encerrado';
  responsabilidade?: 'humano' | 'ia';
  avisoFailover?: string | null;
  distribuidoEm?: Date | null;
  confirmedAt?: Date | null;
}

export interface Mensagem {
  id: string;
  chatId: string;
  remetente: RemetenteMensagem;
  texto: string;
  timestamp: Date;
}

export interface Lembrete {
  id: string;
  chatId: string;
  atendenteId: string;
  clienteNome: string;
  descricao: string;
  dataHora: Date;
  prioridade: PrioridadeLembrete;
  status: StatusLembrete;
  configuracaoAntecedencia: AntecedenciaLembrete;
}

export type StatusCampanha = 'rascunho' | 'agendada' | 'processando' | 'concluida' | 'pausada';

export interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  status: StatusCampanha;
  agendadoPara: Date | null;
  criadoEm: Date;
  totalAlvos: number;
  enviados: number;
  erros: number;
  filtros: {
    tags?: string[];
    origem?: string;
    setorId?: string;
    canal?: CanalAtendimento;
  };
}
