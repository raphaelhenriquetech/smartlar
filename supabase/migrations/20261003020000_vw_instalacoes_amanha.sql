-- =============================================================================
-- SmartLar — 05 View para a automação de lembrete (n8n)
-- Instalações agendadas para amanhã no horário de Brasília. O filtro de data
-- fica no banco (fuso correto, testável) e o n8n só consulta a view.
-- =============================================================================

create view public.vw_instalacoes_amanha
with (security_invoker = true)
as
select
  v.id,
  v.numero,
  v.data_instalacao,
  v.cliente_nome,
  v.cliente_endereco,
  v.cliente_telefone,
  v.tecnico_nome
from public.vw_pedidos_detalhados v
where v.status = 'agendado'
  -- Intervalo [amanhã 00:00, depois de amanhã 00:00) em SP: usa o índice de data_instalacao.
  and v.data_instalacao >= date_trunc('day', now(), 'America/Sao_Paulo') + interval '1 day'
  and v.data_instalacao <  date_trunc('day', now(), 'America/Sao_Paulo') + interval '2 days'
order by v.data_instalacao;

-- Os privilégios padrão do schema dariam TRUNCATE/REFERENCES/TRIGGER para anon:
-- revoga tudo e concede só a leitura.
revoke all on public.vw_instalacoes_amanha from public, anon, authenticated, service_role;
grant select on public.vw_instalacoes_amanha to authenticated, service_role;
