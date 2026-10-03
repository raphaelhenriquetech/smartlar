-- =============================================================================
-- SmartLar — 01 Schema
-- Tipos, tabelas, constraints e índices.
-- Regras que dependem de outras linhas (cálculo do total, fluxo de status,
-- histórico) ficam na migration de regras de negócio.
-- =============================================================================

-- Enums -----------------------------------------------------------------------

create type public.status_pedido as enum (
  'orcamento', 'aprovado', 'agendado', 'em_andamento', 'concluido', 'cancelado'
);

create type public.categoria_produto as enum ('seguranca', 'iluminacao', 'automacao');

create type public.forma_pagamento as enum (
  'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'dinheiro'
);

-- Clientes --------------------------------------------------------------------

create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (btrim(nome) <> ''),
  -- WhatsApp: só dígitos. DDD + número (10 ou 11) ou com DDI 55 (12 ou 13).
  telefone    text not null unique check (telefone ~ '^[0-9]{10,13}$'),
  email       text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Endereço onde a instalação é feita.
  endereco    text not null check (btrim(endereco) <> ''),
  created_at  timestamptz not null default now()
);

-- Técnicos --------------------------------------------------------------------

create table public.tecnicos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (btrim(nome) <> ''),
  telefone       text not null check (telefone ~ '^[0-9]{10,13}$'),
  especialidade  text not null check (btrim(especialidade) <> ''),
  -- Desativar em vez de excluir: o técnico continua ligado aos pedidos antigos.
  ativo          boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Produtos --------------------------------------------------------------------

create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null unique check (btrim(nome) <> ''),
  categoria       public.categoria_produto not null,
  preco_unitario  numeric(10,2) not null check (preco_unitario >= 0),
  descricao       text,
  -- Produto fora de linha: some do catálogo, mas os pedidos antigos continuam válidos.
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Pedidos ---------------------------------------------------------------------

create table public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  -- Número amigável para falar com o cliente ("pedido #1004").
  numero           bigint generated always as identity (start with 1001) unique,
  cliente_id       uuid not null references public.clientes (id) on delete restrict,
  tecnico_id       uuid references public.tecnicos (id) on delete restrict,
  status           public.status_pedido not null default 'orcamento',
  -- Data e hora da instalação (a automação de lembrete precisa do horário).
  data_instalacao  timestamptz,
  -- Sempre igual à soma dos subtotais dos itens (mantido por trigger).
  valor_total      numeric(10,2) not null default 0 check (valor_total >= 0),
  forma_pagamento  public.forma_pagamento,
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A partir do agendamento o pedido precisa ter técnico e data.
  constraint pedidos_agendamento_completo check (
    status not in ('agendado', 'em_andamento', 'concluido')
    or (tecnico_id is not null and data_instalacao is not null)
  ),
  -- A forma de pagamento é combinada quando o cliente aprova o orçamento.
  constraint pedidos_pagamento_definido check (
    status not in ('aprovado', 'agendado', 'em_andamento', 'concluido')
    or forma_pagamento is not null
  )
);

-- Itens do pedido -------------------------------------------------------------

create table public.itens_pedido (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos (id) on delete cascade,
  produto_id      uuid not null references public.produtos (id) on delete restrict,
  quantidade      integer not null check (quantidade > 0),
  -- Cópia do preço no momento do orçamento: mudar o catálogo não altera pedidos já feitos.
  preco_unitario  numeric(10,2) not null check (preco_unitario >= 0),
  subtotal        numeric(10,2) generated always as (quantidade * preco_unitario) stored,

  constraint itens_pedido_produto_unico unique (pedido_id, produto_id)
);

-- Histórico de status ---------------------------------------------------------

create table public.historico_status (
  id               bigint generated always as identity primary key,
  pedido_id        uuid not null references public.pedidos (id) on delete cascade,
  -- Nulo no registro de criação do pedido.
  status_anterior  public.status_pedido,
  status_novo      public.status_pedido not null,
  alterado_em      timestamptz not null default now(),
  alterado_por     uuid references auth.users (id) on delete set null
);

-- Índices ---------------------------------------------------------------------

create index pedidos_cliente_id_idx       on public.pedidos (cliente_id);
create index pedidos_tecnico_id_idx       on public.pedidos (tecnico_id);
create index pedidos_status_idx           on public.pedidos (status);
create index pedidos_data_instalacao_idx  on public.pedidos (data_instalacao);

-- itens_pedido(pedido_id) já é coberto pelo índice da unique (pedido_id, produto_id).
create index itens_pedido_produto_id_idx  on public.itens_pedido (produto_id);

create index historico_status_pedido_id_idx     on public.historico_status (pedido_id);
create index historico_status_alterado_por_idx  on public.historico_status (alterado_por);
