# SmartLar · Gestão de pedidos e instalações

Sistema de gestão para a SmartLar, empresa de automação residencial: cadastro de clientes e produtos,
orçamentos com cálculo automático, fluxo de status do pedido, agenda dos técnicos e dashboard do dono.
Automações no n8n registram novos pedidos, alertam instalações do dia seguinte e lançam o faturamento.

**App:** https://smartlar-beta.vercel.app (acesso com login; credenciais enviadas à parte)

## Stack

- **Banco e auth:** Supabase (Postgres, RLS, Auth por e-mail e senha)
- **Front:** React 19 + Vite + TypeScript + Tailwind CSS, com supabase-js e react-router; deploy na Vercel
- **Automações:** n8n Cloud + Google Sheets
- **Apoio:** ViaCEP para preencher o endereço pelo CEP

## Estrutura

```
supabase/
  migrations/     schema, regras de negócio (triggers), RPC e views, RLS e GRANTs, view do n8n
  seed.sql        dados de demonstração (7 clientes, 10 produtos, 10 pedidos em todos os status)
  validacao.sql   queries de teste: cálculo, fluxo de status, permissões
web/              front-end (6 telas + login)
n8n/              workflows exportados em JSON + README com a configuração
```

As regras de negócio ficam no banco e valem para qualquer cliente (front, n8n ou painel):

- O total do pedido é a soma dos itens, recalculada por trigger.
- O fluxo de status é validado: transições inválidas como `orcamento → concluido` são bloqueadas com mensagem em português.
- Os itens só mudam enquanto o pedido é orçamento.
- Toda mudança de status fica registrada em `historico_status`.

## Rodar o front local

```bash
cd web
npm ci
cp .env.example .env.local   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

`npm run build` faz a checagem de tipos e o build, com saída em `web/dist`. Na Vercel: Root Directory `web`, com as
mesmas duas variáveis de ambiente cadastradas **antes** do build (o Vite as embute no código).

## Banco: migrations e seed

Requer o [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase link --project-ref <project-ref>
supabase db push --include-seed                  # aplica as migrations e carrega o seed
supabase db query --linked -f supabase/seed.sql  # recarrega só o seed
```

O seed **apaga todos os dados** (`TRUNCATE ... RESTART IDENTITY`) e recria a demonstração com datas relativas
ao momento em que roda: "amanhã" e "próximos 7 dias" continuam válidos, e a numeração volta para #1001.
Se os Database Webhooks estiverem ativos, desative-os antes de recarregar, porque cada linha recriada dispara as automações.

Para validar, rode os blocos de `supabase/validacao.sql`, um por vez, no SQL Editor.

## Automações (n8n)

1. Importe `n8n/00-erros.json` a `03-faturamento.json` (menu ⋯ → Import from File).
2. Selecione as credenciais nos nós: Supabase, Google Sheets e Header Auth (`x-webhook-secret`).
3. Em 01–03, defina **Settings → Error Workflow** = 00 Erros e ative os workflows.
4. No Supabase, crie dois **Database Webhooks** em `pedidos` apontando para as Production URLs:
   - INSERT → `/webhook/novo-pedido`
   - UPDATE → `/webhook/pedido-concluido`
   - Em ambos, envie o header `x-webhook-secret`.

Detalhes e decisões em [`n8n/README.md`](n8n/README.md).

## Limitações conhecidas

- **Permissões:** todo usuário logado tem acesso total (sistema interno, cadastro público desativado). Não há
  papéis separados para dono e técnico.
- **Orçamentos:** depois de salvo, não há tela para editar os itens. O banco permite enquanto o pedido é
  orçamento, mas o front não oferece; para corrigir, exclua e recrie.
- **Endereço:** fica em uma única coluna de texto, montada no mesmo formato a partir do CEP. Por isso não dá para
  filtrar por bairro ou cidade.
- **Webhook de UPDATE:** dispara a cada alteração do pedido. O n8n filtra a conclusão, mas os outros eventos
  contam como execução. Os Database Webhooks são configurados no painel, fora das migrations, porque levam o segredo.
- **Fuso:** o agendamento usa o horário de Brasília fixo em UTC-3 (sem horário de verão desde 2019).
- **Testes e bundle:** não há testes automatizados de front; a validação do banco está em `validacao.sql`.
  O bundle do front é um arquivo único de ~580 kB (sem code splitting).
