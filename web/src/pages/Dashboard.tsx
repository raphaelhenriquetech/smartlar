import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CalendarClock, ChevronRight, ClipboardList, HandCoins, Wallet, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dados, useCarregar } from '../lib/hooks'
import {
  chaveDia, chaveDiaRelativa, diasDesde, formatarBRL, formatarData, formatarDiaSemana, formatarHora,
} from '../lib/format'
import type { Indicadores, PedidoDetalhado, ProximaInstalacao } from '../lib/types'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, SectionTitle, cx } from '../components/ui'

function Indicador({
  titulo, valor, detalhe, icone: Icone, cor, link,
}: {
  titulo: string
  valor: string
  detalhe: string
  icone: LucideIcon
  cor: string
  link?: string
}) {
  const conteudo = (
    <Card className={cx('h-full p-5', link && 'transition-colors hover:border-teal-300')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        <div className={cx('rounded-lg p-2', cor)}>
          <Icone className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalhe}</p>
    </Card>
  )
  return link ? <Link to={link}>{conteudo}</Link> : conteudo
}

function quandoInstalacao(iso: string) {
  const chave = chaveDia(iso)
  if (chave === chaveDiaRelativa(0)) return 'Hoje'
  if (chave === chaveDiaRelativa(1)) return 'Amanhã'
  const texto = formatarDiaSemana(iso)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export default function Dashboard() {
  const { data, carregando, erro, recarregar } = useCarregar(async () => {
    const [indicadores, proximas, orcamentos] = await Promise.all([
      supabase
        .from('vw_dashboard_indicadores')
        .select('*')
        .single()
        .then(({ data: linha, error }) => {
          if (error) throw error
          return linha as Indicadores
        }),
      dados(supabase.from('vw_proximas_instalacoes').select('*')) as Promise<ProximaInstalacao[]>,
      dados(
        supabase.from('vw_pedidos_detalhados').select('*').eq('status', 'orcamento').order('created_at'),
      ) as Promise<PedidoDetalhado[]>,
    ])
    return { indicadores, proximas, orcamentos }
  })

  const hoje = formatarDiaSemana(new Date().toISOString())
  const cabecalho = (
    <PageHeader titulo="Dashboard" descricao={hoje.charAt(0).toUpperCase() + hoje.slice(1)} />
  )

  if (carregando && !data) return <>{cabecalho}<Card><LoadingState /></Card></>
  if (erro || !data) return <>{cabecalho}<Card><ErrorState mensagem={erro ?? 'Erro ao carregar.'} onTentarNovamente={recarregar} /></Card></>

  const { indicadores, proximas, orcamentos } = data
  const totalOrcamentos = orcamentos.reduce((soma, p) => soma + p.valor_total, 0)

  return (
    <>
      {cabecalho}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Pedidos no mês"
          valor={String(indicadores.pedidos_mes)}
          detalhe="Criados neste mês"
          icone={ClipboardList}
          cor="bg-sky-50 text-sky-600"
          link="/pedidos"
        />
        <Indicador
          titulo="Faturado no mês"
          valor={formatarBRL(indicadores.faturado_mes)}
          detalhe="Pedidos concluídos neste mês"
          icone={Wallet}
          cor="bg-emerald-50 text-emerald-600"
          link="/pedidos?status=concluido"
        />
        <Indicador
          titulo="A receber"
          valor={formatarBRL(indicadores.a_receber)}
          detalhe="Aprovados, agendados e em andamento"
          icone={HandCoins}
          cor="bg-violet-50 text-violet-600"
        />
        <Indicador
          titulo="Pendentes de agendamento"
          valor={String(indicadores.pendentes_agendamento)}
          detalhe="Aprovados sem técnico e data"
          icone={CalendarClock}
          cor={indicadores.pendentes_agendamento > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}
          link="/pedidos?status=aprovado"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle acao={<LinkSecao to="/agenda">Agenda</LinkSecao>}>Próximas instalações (7 dias)</SectionTitle>
          {proximas.length === 0 ? (
            <EmptyState titulo="Nenhuma instalação nos próximos 7 dias" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {proximas.map((p) => (
                <li key={p.id}>
                  <Link to={`/pedidos/${p.id}`} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50">
                    <div className="w-24 shrink-0">
                      <p className="text-sm font-medium text-slate-900">{quandoInstalacao(p.data_instalacao)}</p>
                      <p className="text-xs tabular-nums text-slate-500">
                        {formatarData(p.data_instalacao).slice(0, 5)} · {formatarHora(p.data_instalacao)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium text-slate-900">{p.cliente_nome}</p>
                      <p className="truncate text-slate-500">{p.cliente_endereco}</p>
                      <p className="mt-0.5 text-xs text-teal-700">{p.tecnico_nome}</p>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            acao={orcamentos.length > 0 && <span className="text-xs text-slate-500">{formatarBRL(totalOrcamentos)} em aberto</span>}
          >
            Orçamentos aguardando aprovação
          </SectionTitle>
          {orcamentos.length === 0 ? (
            <EmptyState titulo="Nenhum orçamento pendente" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {orcamentos.map((p) => {
                const dias = diasDesde(p.created_at)
                return (
                  <li key={p.id}>
                    <Link to={`/pedidos/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                      <span className="w-12 shrink-0 text-sm font-semibold text-slate-900">#{p.numero}</span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium text-slate-900">{p.cliente_nome}</p>
                        <p className={cx('text-xs', dias >= 3 ? 'font-medium text-amber-600' : 'text-slate-500')}>
                          {dias === 0 ? 'Enviado hoje' : `Há ${dias} dia${dias > 1 ? 's' : ''}`}
                          {dias >= 3 && ' · cobrar retorno'}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-slate-900">{formatarBRL(p.valor_total)}</span>
                      <ChevronRight className="size-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function LinkSecao({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs font-medium text-teal-700 hover:text-teal-800">
      {children}
    </Link>
  )
}
