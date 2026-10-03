-- =============================================================================
-- SmartLar — Seed de demonstração
--
-- Primeira carga (junto com as migrations):
--   supabase db push --include-seed
--
-- Para re-executar depois do primeiro push (ex.: atualizar as datas antes da
-- entrega ou da entrevista):
--   supabase db query --linked -f supabase/seed.sql
--
-- ATENÇÃO: começa com TRUNCATE ... RESTART IDENTITY. Apaga todos os dados das
-- tabelas do sistema, e o número dos pedidos volta para 1001.
--
-- As datas são relativas a now() e ficam fixas no momento em que o seed roda:
-- re-execute perto da entrega para "amanhã" e "próximos 7 dias" continuarem
-- válidos.
--
-- Os pedidos são criados pela função criar_pedido e avançados por UPDATE,
-- passando pelos mesmos triggers que o front usa (valida o fluxo e grava o
-- histórico). Depois, as datas do histórico são retroagidas: now() é fixo
-- dentro da transação e, sem isso, todo o histórico teria o mesmo horário.
-- =============================================================================

truncate table
  public.historico_status,
  public.itens_pedido,
  public.pedidos,
  public.produtos,
  public.tecnicos,
  public.clientes
restart identity cascade;

-- Técnicos --------------------------------------------------------------------

insert into public.tecnicos (nome, telefone, especialidade) values
  ('Lucas Andrade', '11988887777', 'Câmeras e sensores'),
  ('Pedro Souza',   '11977776666', 'Fechaduras e iluminação');

-- Produtos --------------------------------------------------------------------

insert into public.produtos (nome, categoria, preco_unitario, descricao) values
  ('Câmera IP',                       'seguranca',   450.00, 'Câmera Wi-Fi Full HD com visão noturna, detecção de movimento e acesso pelo app.'),
  ('Sensor de presença',              'seguranca',   180.00, 'Sensor infravermelho sem fio para alarme e acionamento de rotinas.'),
  ('Fechadura digital biométrica',    'seguranca',  1290.00, 'Abre com digital, senha, cartão ou app. Instalação na porta existente.'),
  ('Sensor de abertura porta/janela', 'seguranca',    95.00, 'Avisa no celular quando uma porta ou janela é aberta.'),
  ('Lâmpada inteligente RGB',         'iluminacao',   89.90, 'Lâmpada LED 10W Wi-Fi, 16 milhões de cores, controle por voz e app.'),
  ('Interruptor inteligente touch',   'iluminacao',  249.00, 'Interruptor de vidro touch 2 canais. Precisa de fio neutro na caixa.'),
  ('Fita LED inteligente 5m',         'iluminacao',  159.00, 'Fita LED RGB com controlador Wi-Fi para sancas e móveis.'),
  ('Assistente de voz',               'automacao',   399.00, 'Smart speaker com assistente de voz para controlar os dispositivos da casa.'),
  ('Hub de automação Zigbee',         'automacao',   349.00, 'Central que conecta sensores e dispositivos Zigbee e executa as rotinas.'),
  ('Tomada inteligente',              'automacao',    79.90, 'Tomada Wi-Fi 10A com agendamento e medição de consumo.');

-- Clientes --------------------------------------------------------------------

insert into public.clientes (nome, telefone, email, endereco) values
  ('Camila Reis',          '11954321987', 'camila.reis@exemplo.com.br',         'Alameda das Acácias, 85 - Residencial Alphaville 3, Barueri/SP'),
  ('Eduardo Nunes',        '11943219876', 'eduardo.nunes@exemplo.com.br',       'Rua Pamplona, 1200, apto 54 - Jardim Paulista, São Paulo/SP'),
  ('Ricardo Tanaka',       '11991234567', 'ricardo.tanaka@exemplo.com.br',      'Av. Ibirapuera, 2100, apto 132 - Moema, São Paulo/SP'),
  ('Mariana Albuquerque',  '11987651234', 'mariana.albuquerque@exemplo.com.br', 'Rua Harmonia, 412, apto 81 - Vila Madalena, São Paulo/SP'),
  ('Fernanda Lopes',       '11976543210', 'fernanda.lopes@exemplo.com.br',      'Rua dos Pinheiros, 870, casa 2 - Pinheiros, São Paulo/SP'),
  ('João Batista Moreira', '11965432198', null,                                 'Rua Tuiuti, 1500 - Tatuapé, São Paulo/SP'),
  ('Patrícia Gomes',       '11932198765', 'patricia.gomes@exemplo.com.br',      'Rua Cayowaá, 300 - Perdizes, São Paulo/SP');

-- Helpers temporários (pg_temp: somem ao fim da sessão) -----------------------

-- Item no formato esperado por criar_pedido, buscando o produto pelo nome.
create function pg_temp.item(p_produto text, p_quantidade integer)
returns jsonb
language sql
as $$
  select jsonb_build_object('produto_id', id, 'quantidade', p_quantidade)
  from public.produtos
  where nome = p_produto;
$$;

-- Cria o pedido pela RPC e retroage a data de criação.
create function pg_temp.novo_pedido(
  p_telefone_cliente text, p_itens jsonb, p_observacoes text, p_criado_em timestamptz)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := public.criar_pedido(
    (select id from public.clientes where telefone = p_telefone_cliente),
    p_itens,
    p_observacoes);

  update public.pedidos set created_at = p_criado_em where id = v_id;
  update public.historico_status set alterado_em = p_criado_em where pedido_id = v_id;

  return v_id;
end;
$$;

-- Avança o status por UPDATE (passando pelos triggers) e retroage a data no histórico.
create function pg_temp.avancar(
  p_pedido_id        uuid,
  p_status           public.status_pedido,
  p_quando           timestamptz,
  p_tecnico          text default null,
  p_data_instalacao  timestamptz default null,
  p_forma_pagamento  public.forma_pagamento default null)
returns void
language plpgsql
as $$
begin
  update public.pedidos
     set status          = p_status,
         tecnico_id      = coalesce((select id from public.tecnicos where nome = p_tecnico), tecnico_id),
         data_instalacao = coalesce(p_data_instalacao, data_instalacao),
         forma_pagamento = coalesce(p_forma_pagamento, forma_pagamento)
   where id = p_pedido_id;

  update public.historico_status
     set alterado_em = p_quando
   where pedido_id = p_pedido_id and status_novo = p_status;
end;
$$;

-- Pedidos ---------------------------------------------------------------------
-- Criados em ordem cronológica, para o número (#1001...) acompanhar a data.
--
-- #1001 concluido (mês anterior)  #1006 agendado (+3 dias, 14h)
-- #1002 cancelado                 #1007 aprovado (aguardando agendamento)
-- #1003 concluido (este mês)      #1008 agendado (+5 dias, 10h)
-- #1004 agendado (amanhã, 9h)     #1009 orcamento
-- #1005 em_andamento              #1010 orcamento (2x Câmera IP + 1x Sensor = R$ 1.080,00)

do $$
declare
  -- 00:00 de hoje e dia 1º do mês, no horário de Brasília.
  v_hoje        timestamptz := date_trunc('day', now(), 'America/Sao_Paulo');
  v_inicio_mes  timestamptz := date_trunc('month', now(), 'America/Sao_Paulo');
  v_id          uuid;
begin
  -- #1001 concluído no mês anterior (prova o filtro do "faturado no mês")
  -- 4x 450 + 2x 180 + 1x 349 = R$ 2.509,00
  v_id := pg_temp.novo_pedido('11954321987',
    jsonb_build_array(
      pg_temp.item('Câmera IP', 4),
      pg_temp.item('Sensor de presença', 2),
      pg_temp.item('Hub de automação Zigbee', 1)),
    'Casa térrea: 4 câmeras externas cobrindo frente, fundos e laterais.',
    v_inicio_mes - interval '25 days' + interval '10 hours');
  perform pg_temp.avancar(v_id, 'aprovado', v_inicio_mes - interval '22 days' + interval '15 hours', p_forma_pagamento => 'cartao_credito');
  perform pg_temp.avancar(v_id, 'agendado', v_inicio_mes - interval '21 days' + interval '11 hours',
    p_tecnico => 'Lucas Andrade', p_data_instalacao => v_inicio_mes - interval '6 days' + interval '9 hours');
  perform pg_temp.avancar(v_id, 'em_andamento', v_inicio_mes - interval '6 days' + interval '9 hours');
  perform pg_temp.avancar(v_id, 'concluido',    v_inicio_mes - interval '6 days' + interval '13 hours');

  -- #1002 cancelado depois de aprovado
  -- 3x 159 + 4x 79,90 = R$ 796,60
  v_id := pg_temp.novo_pedido('11943219876',
    jsonb_build_array(
      pg_temp.item('Fita LED inteligente 5m', 3),
      pg_temp.item('Tomada inteligente', 4)),
    'Cliente desistiu: vai reformar a cozinha antes. Retomar contato em 2 meses.',
    now() - interval '15 days');
  perform pg_temp.avancar(v_id, 'aprovado',  now() - interval '13 days', p_forma_pagamento => 'boleto');
  perform pg_temp.avancar(v_id, 'cancelado', now() - interval '9 days');

  -- #1003 concluído neste mês (entra no "faturado no mês")
  -- 8x 89,90 + 2x 249 + 1x 399 = R$ 1.616,20
  v_id := pg_temp.novo_pedido('11991234567',
    jsonb_build_array(
      pg_temp.item('Lâmpada inteligente RGB', 8),
      pg_temp.item('Interruptor inteligente touch', 2),
      pg_temp.item('Assistente de voz', 1)),
    'Cenas de iluminação na sala e no home theater.',
    now() - interval '14 days');
  perform pg_temp.avancar(v_id, 'aprovado', now() - interval '12 days', p_forma_pagamento => 'pix');
  perform pg_temp.avancar(v_id, 'agendado', now() - interval '11 days',
    p_tecnico => 'Pedro Souza', p_data_instalacao => now() - interval '5 hours');
  perform pg_temp.avancar(v_id, 'em_andamento', now() - interval '5 hours');
  perform pg_temp.avancar(v_id, 'concluido',    now() - interval '2 hours');

  -- #1004 agendado para AMANHÃ às 9h (alvo da automação de lembrete)
  -- 3x 450 + 2x 95 = R$ 1.540,00
  v_id := pg_temp.novo_pedido('11991234567',
    jsonb_build_array(
      pg_temp.item('Câmera IP', 3),
      pg_temp.item('Sensor de abertura porta/janela', 2)),
    'Apartamento: avisar a portaria com 1 dia de antecedência; acesso pela garagem.',
    now() - interval '10 days');
  perform pg_temp.avancar(v_id, 'aprovado', now() - interval '8 days', p_forma_pagamento => 'cartao_credito');
  perform pg_temp.avancar(v_id, 'agendado', now() - interval '7 days',
    p_tecnico => 'Lucas Andrade', p_data_instalacao => v_hoje + interval '1 day 9 hours');

  -- #1005 em andamento (instalação começou há 2 horas)
  -- 3x 180 + 1x 349 = R$ 889,00
  v_id := pg_temp.novo_pedido('11987651234',
    jsonb_build_array(
      pg_temp.item('Sensor de presença', 3),
      pg_temp.item('Hub de automação Zigbee', 1)),
    'Sensores no corredor, na sala e no escritório, integrados ao hub.',
    now() - interval '9 days');
  perform pg_temp.avancar(v_id, 'aprovado', now() - interval '7 days', p_forma_pagamento => 'pix');
  perform pg_temp.avancar(v_id, 'agendado', now() - interval '6 days',
    p_tecnico => 'Lucas Andrade', p_data_instalacao => now() - interval '2 hours');
  perform pg_temp.avancar(v_id, 'em_andamento', now() - interval '2 hours');

  -- #1006 agendado para daqui a 3 dias, 14h
  -- 1x 1.290 + 2x 79,90 = R$ 1.449,80
  v_id := pg_temp.novo_pedido('11954321987',
    jsonb_build_array(
      pg_temp.item('Fechadura digital biométrica', 1),
      pg_temp.item('Tomada inteligente', 2)),
    'Porta de madeira maciça: levar broca e gabarito para fechadura de embutir.',
    now() - interval '7 days');
  perform pg_temp.avancar(v_id, 'aprovado', now() - interval '5 days', p_forma_pagamento => 'boleto');
  perform pg_temp.avancar(v_id, 'agendado', now() - interval '4 days',
    p_tecnico => 'Pedro Souza', p_data_instalacao => v_hoje + interval '3 days 14 hours');

  -- #1007 aprovado, aguardando agendamento
  -- 3x 249 + 1x 399 = R$ 1.146,00
  v_id := pg_temp.novo_pedido('11976543210',
    jsonb_build_array(
      pg_temp.item('Interruptor inteligente touch', 3),
      pg_temp.item('Assistente de voz', 1)),
    'Trocar interruptores da sala e dos quartos. Confirmar se há fio neutro nas caixas.',
    now() - interval '6 days');
  perform pg_temp.avancar(v_id, 'aprovado', now() - interval '4 days', p_forma_pagamento => 'pix');

  -- #1008 agendado para daqui a 5 dias, 10h
  -- 2x 159 + 6x 89,90 + 1x 349 = R$ 1.206,40
  v_id := pg_temp.novo_pedido('11965432198',
    jsonb_build_array(
      pg_temp.item('Fita LED inteligente 5m', 2),
      pg_temp.item('Lâmpada inteligente RGB', 6),
      pg_temp.item('Hub de automação Zigbee', 1)),
    'Sanca de LED na sala; cliente prefere instalação pela manhã.',
    now() - interval '5 days');
  perform pg_temp.avancar(v_id, 'aprovado', now() - interval '3 days', p_forma_pagamento => 'dinheiro');
  perform pg_temp.avancar(v_id, 'agendado', now() - interval '2 days',
    p_tecnico => 'Pedro Souza', p_data_instalacao => v_hoje + interval '5 days 10 hours');

  -- #1009 orçamento
  -- 1x 1.290 + 4x 89,90 = R$ 1.649,60
  v_id := pg_temp.novo_pedido('11943219876',
    jsonb_build_array(
      pg_temp.item('Fechadura digital biométrica', 1),
      pg_temp.item('Lâmpada inteligente RGB', 4)),
    'Portão eletrônico antigo, verificar compatibilidade.',
    now() - interval '1 day');

  -- #1010 orçamento — exemplo do enunciado
  -- 2x Câmera IP (450) + 1x Sensor de presença (180) = R$ 1.080,00
  v_id := pg_temp.novo_pedido('11987651234',
    jsonb_build_array(
      pg_temp.item('Câmera IP', 2),
      pg_temp.item('Sensor de presença', 1)),
    'Câmeras na garagem e no quintal; sensor no corredor de entrada.',
    now() - interval '3 hours');
end;
$$;
