-- =============================================================================
-- SmartLar — Queries de validação
-- Rode bloco a bloco no SQL Editor do Supabase, ou pelo CLI:
--   supabase db query --linked "<query>"
-- Os testes que alteram dados ficam entre BEGIN e ROLLBACK: nada é gravado.
-- Os números de pedido (#1003, #1004, #1007, #1010) vêm do seed.
-- =============================================================================

-- 1) Cálculo: #1010 = 2x Câmera IP (450,00) + 1x Sensor de presença (180,00)
--    Esperado: subtotais 900,00 e 180,00; valor_total 1080,00
select p.numero, pr.nome as produto, i.quantidade, i.preco_unitario, i.subtotal, p.valor_total
from public.pedidos p
join public.itens_pedido i on i.pedido_id = p.id
join public.produtos pr on pr.id = i.produto_id
where p.numero = 1010
order by i.subtotal desc;

-- 2) Conferência geral: valor_total = soma dos subtotais em todos os pedidos
--    Esperado: 0 linhas
select p.numero, p.valor_total, coalesce(sum(i.subtotal), 0) as soma_itens
from public.pedidos p
left join public.itens_pedido i on i.pedido_id = p.id
group by p.id
having p.valor_total <> coalesce(sum(i.subtotal), 0);

-- 3) Fluxo de status: orcamento → concluido no #1010
--    Esperado: ERRO "Transição de status inválida: "orcamento" → "concluido"..."
begin;
update public.pedidos set status = 'concluido' where numero = 1010;
rollback;

-- 4) Aprovar o #1010 sem forma de pagamento (transição válida, dado faltando)
--    Esperado: ERRO "Para o status "aprovado" é obrigatório informar a forma de pagamento."
begin;
update public.pedidos set status = 'aprovado' where numero = 1010;
rollback;

-- 5) Agendar sem técnico e data (#1007 está aprovado)
--    Esperado: ERRO "Para o status "agendado" é obrigatório informar o técnico e a data..."
begin;
update public.pedidos set status = 'agendado' where numero = 1007;
rollback;

-- 6) Itens travados fora do orçamento: adicionar item no #1004 (agendado)
--    Esperado: ERRO "Não é possível alterar itens de um pedido com status "agendado"..."
begin;
insert into public.itens_pedido (pedido_id, produto_id, quantidade)
select p.id, pr.id, 1
from public.pedidos p, public.produtos pr
where p.numero = 1004 and pr.nome = 'Tomada inteligente';
rollback;

-- 7) Views
select * from public.vw_dashboard_indicadores;

select numero,
       to_char(data_instalacao at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as quando,
       cliente_nome, cliente_endereco, tecnico_nome
from public.vw_proximas_instalacoes;

select numero, status, cliente_nome, tecnico_nome, valor_total, forma_pagamento,
       to_char(data_instalacao at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as instalacao,
       to_char(concluido_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as concluido_em
from public.vw_pedidos_detalhados
order by numero;

-- 8) Histórico de status do #1003 (passou por todo o fluxo até concluído)
select h.status_anterior, h.status_novo,
       to_char(h.alterado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as quando
from public.historico_status h
join public.pedidos p on p.id = h.pedido_id
where p.numero = 1003
order by h.alterado_em;

-- 9) Permissões
-- 9a) anon (sem login) não lê nada
--     Esperado: ERRO "permission denied for table clientes"
begin;
set local role anon;
select count(*) from public.clientes;
rollback;

-- 9b) authenticated cria pedido pela RPC (cliente sem pedidos, Patrícia)
--     Esperado: sem erro (o pedido é desfeito no rollback)
begin;
set local role authenticated;
select public.criar_pedido(
  (select id from public.clientes where telefone = '11932198765'),
  jsonb_build_array(jsonb_build_object(
    'produto_id', (select id from public.produtos where nome = 'Tomada inteligente'),
    'quantidade', 2)),
  'teste de permissão');
rollback;

-- 9c) authenticated não escreve no histórico
--     Esperado: ERRO "permission denied for table historico_status"
begin;
set local role authenticated;
delete from public.historico_status;
rollback;

-- 9d) authenticated tenta excluir o #1003 (concluído)
--     Esperado: ERRO "Só é possível excluir pedidos em orçamento..." (e não "0 linhas").
--     A policy deixa a linha visível e o GRANT de delete existe, então o DELETE
--     chega ao trigger BEFORE DELETE, que aborta. "0 linhas sem erro" só
--     aconteceria se a RLS escondesse a linha: RLS filtra em silêncio, trigger falha.
begin;
set local role authenticated;
delete from public.pedidos where numero = 1003;
rollback;
