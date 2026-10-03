# Automações n8n — SmartLar

Workflows exportados em JSON, prontos para importar no n8n (testados contra as definições de nós do n8n 2.15).
Todos usam timezone `America/Sao_Paulo`, **Retry On Fail (3x, 2s)** nos nós Supabase e Google Sheets e gravam na planilha
`1E67t6jBxZMqSXO1DFsRmaGhMCZs_LYtYZaXEzgU254U`.

| Arquivo | Gatilho | O que faz | Aba |
|---|---|---|---|
| `00-erros.json` | Error Trigger | Registra qualquer falha dos workflows 01–03 (workflow, nó, mensagem, link da execução) | Erros |
| `01-novo-pedido.json` | Webhook `POST /novo-pedido` (Database Webhook INSERT em `pedidos`) | Busca o pedido em `vw_pedidos_detalhados` e registra data, número, cliente, telefone, total e observações | Novos pedidos |
| `02-alerta-instalacao.json` | Todo dia às 18h | Lê `vw_instalacoes_amanha`; uma linha por instalação ou uma linha "Sem instalações para amanhã" | Alertas instalação |
| `03-faturamento.json` | Webhook `POST /pedido-concluido` (Database Webhook UPDATE em `pedidos`) | Só na transição para `concluido`: registra data da conclusão, cliente, valor, forma de pagamento | Faturamento |

## Credenciais (referenciadas pelo nome)

| Nome no n8n | Tipo | Uso |
|---|---|---|
| `Supabase SmartLar` | Supabase API | Host `https://nlwmcfzwpmeictdcqwlj.supabase.co` + chave **service_role** (secret) |
| `Google Sheets SmartLar` | Google Sheets OAuth2 | Gravação na planilha |
| `Webhook SmartLar` | Header Auth | Header `x-webhook-secret` com o segredo compartilhado com o Supabase |

## Decisões

- **Webhook protegido**: a URL do webhook é pública; sem o header `x-webhook-secret` correto o n8n responde 403 e nada roda.
- **Buscar o pedido de novo** (01 e 03): o Database Webhook dispara no INSERT do pedido, antes dos itens, então o payload
  chega com `valor_total = 0` e sem nome do cliente. A consulta à view traz o pedido já completo (o HTTP só sai depois do commit).
- **Filtro de data no banco** (02): "amanhã no fuso de SP" é calculado na view `vw_instalacoes_amanha`; o n8n só consulta.
- **Always Output Data** no Supabase: sem resultado o fluxo não para em silêncio; segue para o ramo "não encontrou"
  (01/03 geram erro com Stop and Error → workflow 00; 02 grava "Sem instalações para amanhã").
- **Planilha em modo auto-map + RAW**: as chaves do item viram as colunas (aba vazia ganha cabeçalho sozinha) e o texto
  é gravado como está (com `USER_ENTERED` o Sheets reinterpreta datas como `03/10/2026` conforme o locale).

## Limitações conhecidas

- O Database Webhook de UPDATE dispara a **cada** alteração em `pedidos` (inclusive o recálculo do total quando itens
  são adicionados); o IF descarta o que não é conclusão, mas cada evento conta como execução no n8n. Com mais tempo:
  trigger próprio com `pg_net` disparando só quando `status` muda para `concluido`.
- Os Database Webhooks são configurados no painel do Supabase (não estão nas migrations) porque levam o segredo no header.
