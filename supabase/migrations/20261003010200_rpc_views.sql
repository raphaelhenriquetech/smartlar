-- =============================================================================
-- SmartLar — 03 RPC e views
-- Datas "do mês", "de hoje" etc. são calculadas no fuso America/Sao_Paulo:
-- o banco guarda tudo em UTC (timestamptz), mas o mês do Rafael começa à
-- meia-noite de Brasília, não à meia-noite UTC.
-- =============================================================================

-- RPC: criar pedido -----------------------------------------------------------

-- Cria o pedido e os itens numa única transação: a chamada da função é
-- atômica, então se um item falhar nada é gravado.
-- security invoker: roda com as permissões de quem chama (RLS e GRANTs valem).
-- p_itens: [{"produto_id": "<uuid>", "quantidade": 2}, ...]
create function public.criar_pedido(
  p_cliente_id   uuid,
  p_itens        jsonb,
  p_observacoes  text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pedido_id uuid;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido precisa ter pelo menos um item.' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente não encontrado.' using errcode = 'foreign_key_violation';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens) as i (produto_id uuid, quantidade integer)
    where i.produto_id is null or i.quantidade is null or i.quantidade <= 0
  ) then
    raise exception 'Cada item precisa de produto_id e de quantidade maior que zero.'
      using errcode = 'check_violation';
  end if;

  insert into public.pedidos (cliente_id, observacoes)
  values (p_cliente_id, nullif(btrim(p_observacoes), ''))
  returning id into v_pedido_id;

  -- O mesmo produto repetido vira uma linha só, com as quantidades somadas
  -- (itens_pedido tem unique (pedido_id, produto_id)).
  -- preco_unitario fica nulo de propósito: o trigger copia o preço do catálogo.
  insert into public.itens_pedido (pedido_id, produto_id, quantidade)
  select v_pedido_id, i.produto_id, sum(i.quantidade)
  from jsonb_to_recordset(p_itens) as i (produto_id uuid, quantidade integer)
  group by i.produto_id;

  return v_pedido_id;
end;
$$;

-- Views -----------------------------------------------------------------------
-- security_invoker = true: a view respeita o RLS/GRANTs de quem consulta,
-- em vez de rodar com as permissões do dono da view.

-- Pedido com cliente e técnico já resolvidos (listas do front e automações).
create view public.vw_pedidos_detalhados
with (security_invoker = true)
as
select
  p.id,
  p.numero,
  p.status,
  p.data_instalacao,
  p.valor_total,
  p.forma_pagamento,
  p.observacoes,
  p.created_at,
  p.updated_at,
  p.cliente_id,
  c.nome      as cliente_nome,
  c.telefone  as cliente_telefone,
  c.email     as cliente_email,
  c.endereco  as cliente_endereco,
  p.tecnico_id,
  t.nome      as tecnico_nome,
  conclusao.concluido_em
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.tecnicos t on t.id = p.tecnico_id
left join lateral (
  select max(h.alterado_em) as concluido_em
  from public.historico_status h
  where h.pedido_id = p.id and h.status_novo = 'concluido'
) conclusao on true;

-- Indicadores do topo do dashboard (uma linha só).
create view public.vw_dashboard_indicadores
with (security_invoker = true)
as
with periodo as (
  select date_trunc('month', now(), 'America/Sao_Paulo') as inicio_mes
)
select
  -- Pedidos criados no mês corrente.
  (select count(*)
     from public.pedidos p
    where p.created_at >= periodo.inicio_mes) as pedidos_mes,

  -- Faturado: pedidos concluídos cuja conclusão (no histórico) foi neste mês.
  (select coalesce(sum(p.valor_total), 0)
     from public.pedidos p
    where p.status = 'concluido'
      and exists (
        select 1
          from public.historico_status h
         where h.pedido_id = p.id
           and h.status_novo = 'concluido'
           and h.alterado_em >= periodo.inicio_mes
      )) as faturado_mes,

  -- A receber: pedidos já fechados com o cliente e ainda não concluídos.
  (select coalesce(sum(p.valor_total), 0)
     from public.pedidos p
    where p.status in ('aprovado', 'agendado', 'em_andamento')) as a_receber,

  -- Aprovados que ainda não têm técnico e data.
  (select count(*)
     from public.pedidos p
    where p.status = 'aprovado') as pendentes_agendamento
from periodo;

-- Instalações agendadas de hoje (desde 00:00 em Brasília) até o fim do 7º dia
-- seguinte. Começa no início do dia, e não em now(), para uma instalação
-- atrasada de hoje não sumir da lista.
create view public.vw_proximas_instalacoes
with (security_invoker = true)
as
select
  v.id,
  v.numero,
  v.data_instalacao,
  v.cliente_id,
  v.cliente_nome,
  v.cliente_telefone,
  v.cliente_endereco,
  v.tecnico_id,
  v.tecnico_nome,
  v.valor_total,
  v.observacoes
from public.vw_pedidos_detalhados v
where v.status = 'agendado'
  and v.data_instalacao >= date_trunc('day', now(), 'America/Sao_Paulo')
  and v.data_instalacao <  date_trunc('day', now(), 'America/Sao_Paulo') + interval '8 days'
order by v.data_instalacao;
