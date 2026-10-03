import type { Database } from './database.types'

type Public = Database['public']

export type Status = Public['Enums']['status_pedido']
export type Categoria = Public['Enums']['categoria_produto']
export type FormaPagamento = Public['Enums']['forma_pagamento']

export type Cliente = Public['Tables']['clientes']['Row']
export type Produto = Public['Tables']['produtos']['Row']
export type Tecnico = Public['Tables']['tecnicos']['Row']
export type HistoricoStatus = Public['Tables']['historico_status']['Row']

// O Postgres marca toda coluna de view como "pode ser nula". Estes campos
// nunca são nulos (vêm de colunas NOT NULL), então tiramos o null do tipo.
type SemNulos<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> }

export type PedidoDetalhado = SemNulos<
  Public['Views']['vw_pedidos_detalhados']['Row'],
  | 'id'
  | 'numero'
  | 'status'
  | 'valor_total'
  | 'created_at'
  | 'cliente_id'
  | 'cliente_nome'
  | 'cliente_telefone'
  | 'cliente_endereco'
>

export type ProximaInstalacao = SemNulos<
  Public['Views']['vw_proximas_instalacoes']['Row'],
  'id' | 'numero' | 'data_instalacao' | 'cliente_nome' | 'cliente_endereco' | 'valor_total'
>

export type Indicadores = SemNulos<
  Public['Views']['vw_dashboard_indicadores']['Row'],
  'pedidos_mes' | 'faturado_mes' | 'a_receber' | 'pendentes_agendamento'
>
