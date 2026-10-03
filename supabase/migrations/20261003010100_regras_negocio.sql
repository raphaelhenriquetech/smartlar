-- =============================================================================
-- SmartLar — 02 Regras de negócio
-- As regras ficam no banco para valerem para todos: front, n8n e quem editar
-- direto no painel do Supabase.
-- Triggers do mesmo evento disparam em ordem alfabética do nome, por isso os
-- prefixos numéricos (10, 20, 30...).
-- =============================================================================

-- Fluxo de status -------------------------------------------------------------

-- Fonte única das transições permitidas. Usada pelo trigger de validação e
-- pelo front (para mostrar só os botões de status possíveis).
create function public.proximos_status(p_status public.status_pedido)
returns public.status_pedido[]
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'orcamento'    then array['aprovado', 'cancelado']::public.status_pedido[]
    when 'aprovado'     then array['agendado', 'cancelado']::public.status_pedido[]
    when 'agendado'     then array['em_andamento']::public.status_pedido[]
    when 'em_andamento' then array['concluido']::public.status_pedido[]
    -- concluido e cancelado são status finais.
    else '{}'::public.status_pedido[]
  end;
$$;

-- updated_at ------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Itens do pedido -------------------------------------------------------------

-- Itens só mudam enquanto o pedido é orçamento: depois de aprovado, o valor
-- combinado com o cliente não pode mais mudar.
create function public.itens_bloquear_fora_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.status_pedido;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into v_status from public.pedidos where id = old.pedido_id;
    -- Pedido não encontrado = ele está sendo excluído (cascade); deixa passar.
    if found and v_status <> 'orcamento' then
      raise exception 'Não é possível alterar itens de um pedido com status "%". Itens só podem ser alterados enquanto o pedido é orçamento.', v_status
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status into v_status from public.pedidos where id = new.pedido_id;
    if found and v_status <> 'orcamento' then
      raise exception 'Não é possível alterar itens de um pedido com status "%". Itens só podem ser alterados enquanto o pedido é orçamento.', v_status
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  return old;
end;
$$;

-- Copia o preço atual do produto quando o item vem sem preço (snapshot) e
-- impede adicionar produto inativo.
create function public.itens_preencher_preco()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_preco numeric(10,2);
  v_ativo boolean;
begin
  select preco_unitario, ativo into v_preco, v_ativo
  from public.produtos
  where id = new.produto_id;

  if not found then
    raise exception 'Produto não encontrado.' using errcode = 'foreign_key_violation';
  end if;

  if not v_ativo and (tg_op = 'INSERT' or new.produto_id is distinct from old.produto_id) then
    raise exception 'O produto selecionado está inativo e não pode ser adicionado ao pedido.'
      using errcode = 'check_violation';
  end if;

  if new.preco_unitario is null then
    new.preco_unitario := v_preco;
  end if;

  return new;
end;
$$;

-- valor_total do pedido = soma dos subtotais dos itens.
-- No INSERT old é nulo e no DELETE new é nulo: o "in" cobre os três casos,
-- inclusive item que mudou de pedido (recalcula os dois).
create function public.itens_recalcular_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.pedidos p
     set valor_total = coalesce(
           (select sum(i.subtotal) from public.itens_pedido i where i.pedido_id = p.id), 0)
   where p.id in (new.pedido_id, old.pedido_id);

  return null;
end;
$$;

-- Pedidos ---------------------------------------------------------------------

-- Todo pedido nasce como orçamento e com total zero (o total vem dos itens).
create function public.pedidos_padrao_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := 'orcamento';
  new.valor_total := 0;
  return new;
end;
$$;

create function public.pedidos_validar_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_permitidos public.status_pedido[];
begin
  -- valor_total é derivado dos itens: qualquer valor enviado manualmente é recalculado.
  if new.valor_total is distinct from old.valor_total then
    new.valor_total := coalesce(
      (select sum(i.subtotal) from public.itens_pedido i where i.pedido_id = new.id), 0);
  end if;

  if new.status is distinct from old.status then
    v_permitidos := public.proximos_status(old.status);

    if not (new.status = any (v_permitidos)) then
      raise exception 'Transição de status inválida: "%" → "%". A partir de "%" o pedido só pode ir para: %.',
        old.status, new.status, old.status,
        coalesce(nullif(array_to_string(v_permitidos, ', '), ''), 'nenhum (status final)')
        using errcode = 'check_violation';
    end if;
  end if;

  -- Mensagens claras para as constraints da tabela (que continuam como garantia final).
  if new.status in ('agendado', 'em_andamento', 'concluido')
     and (new.tecnico_id is null or new.data_instalacao is null) then
    raise exception 'Para o status "%" é obrigatório informar o técnico e a data de instalação.', new.status
      using errcode = 'check_violation';
  end if;

  if new.status in ('aprovado', 'agendado', 'em_andamento', 'concluido')
     and new.forma_pagamento is null then
    raise exception 'Para o status "%" é obrigatório informar a forma de pagamento.', new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Só orçamento pode ser excluído. Depois de aprovado o pedido fica registrado
-- (o caminho é cancelar), preservando o histórico.
create function public.pedidos_bloquear_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'orcamento' then
    raise exception 'Só é possível excluir pedidos em orçamento (status atual: "%"). Pedidos já aprovados ficam registrados para manter o histórico.', old.status
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

-- Registra a criação (null → orcamento) e cada mudança de status.
-- security definer: os usuários só têm leitura em historico_status; a escrita
-- acontece apenas por aqui.
create function public.pedidos_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.historico_status (pedido_id, status_anterior, status_novo, alterado_por)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    auth.uid()
  );

  return null;
end;
$$;

-- Triggers --------------------------------------------------------------------

create trigger trg_produtos_10_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

create trigger trg_itens_10_bloquear_fora_orcamento
  before insert or update or delete on public.itens_pedido
  for each row execute function public.itens_bloquear_fora_orcamento();

create trigger trg_itens_20_preencher_preco
  before insert or update on public.itens_pedido
  for each row execute function public.itens_preencher_preco();

create trigger trg_itens_30_recalcular_total
  after insert or update or delete on public.itens_pedido
  for each row execute function public.itens_recalcular_total();

create trigger trg_pedidos_10_padrao_insert
  before insert on public.pedidos
  for each row execute function public.pedidos_padrao_insert();

create trigger trg_pedidos_20_validar_update
  before update on public.pedidos
  for each row execute function public.pedidos_validar_update();

create trigger trg_pedidos_30_updated_at
  before update on public.pedidos
  for each row execute function public.set_updated_at();

create trigger trg_pedidos_40_bloquear_delete
  before delete on public.pedidos
  for each row execute function public.pedidos_bloquear_delete();

create trigger trg_pedidos_90_historico_insert
  after insert on public.pedidos
  for each row execute function public.pedidos_registrar_historico();

create trigger trg_pedidos_91_historico_status
  after update of status on public.pedidos
  for each row
  when (old.status is distinct from new.status)
  execute function public.pedidos_registrar_historico();
