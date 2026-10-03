-- =============================================================================
-- SmartLar — 04 RLS e GRANTs
-- Sistema interno: todo usuário logado é da equipe da SmartLar (Rafael e
-- técnicos), então authenticated tem acesso total e anon (sem login) não
-- acessa nada. O cadastro público no Auth fica desativado; os usuários são
-- criados pelo painel.
--
-- O projeto foi criado sem exposição automática de tabelas. Além disso, os
-- privilégios padrão do schema dão TRUNCATE/REFERENCES/TRIGGER para anon e
-- authenticated em toda tabela nova (TRUNCATE ignora RLS e triggers). Por
-- isso: primeiro revoga tudo, depois concede só o necessário.
-- =============================================================================

-- RLS -------------------------------------------------------------------------

alter table public.clientes          enable row level security;
alter table public.tecnicos          enable row level security;
alter table public.produtos          enable row level security;
alter table public.pedidos           enable row level security;
alter table public.itens_pedido      enable row level security;
alter table public.historico_status  enable row level security;

create policy "equipe_acesso_total" on public.clientes
  for all to authenticated using (true) with check (true);

create policy "equipe_acesso_total" on public.tecnicos
  for all to authenticated using (true) with check (true);

create policy "equipe_acesso_total" on public.produtos
  for all to authenticated using (true) with check (true);

create policy "equipe_acesso_total" on public.pedidos
  for all to authenticated using (true) with check (true);

create policy "equipe_acesso_total" on public.itens_pedido
  for all to authenticated using (true) with check (true);

-- Histórico: só leitura. A escrita é feita pelo trigger security definer.
create policy "equipe_somente_leitura" on public.historico_status
  for select to authenticated using (true);

-- GRANTs: tabelas e views -----------------------------------------------------

grant usage on schema public to authenticated, service_role;

revoke all on all tables in schema public from public, anon, authenticated, service_role;

grant select, insert, update, delete
  on public.clientes, public.tecnicos, public.produtos, public.pedidos, public.itens_pedido
  to authenticated, service_role;

grant select on public.historico_status to authenticated, service_role;

grant select
  on public.vw_pedidos_detalhados, public.vw_dashboard_indicadores, public.vw_proximas_instalacoes
  to authenticated, service_role;

-- GRANTs: funções -------------------------------------------------------------
-- Funções de trigger não precisam de EXECUTE para disparar. Só ficam
-- executáveis as funções chamadas pelo front/n8n (e proximos_status, que
-- também é chamada de dentro do trigger de validação).

revoke execute on all functions in schema public from public, anon, authenticated, service_role;

grant execute on function public.criar_pedido(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.proximos_status(public.status_pedido) to authenticated, service_role;

-- Sequences: nenhum GRANT necessário. As PKs são uuid, e pedidos.numero e
-- historico_status.id são identity, que não exige permissão na sequence.
