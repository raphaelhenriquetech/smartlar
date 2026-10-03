import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { CircleCheck, CirclePlay, MapPin, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dados, useCarregar } from '../lib/hooks'
import { toastErro } from '../lib/errors'
import {
  chaveDia, chaveDiaRelativa, formatarDiaSemana, formatarHora, formatarTelefone, linkMapa, linkWhatsApp,
} from '../lib/format'
import type { PedidoDetalhado } from '../lib/types'
import {
  Button, Card, ConfirmModal, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, cx,
} from '../components/ui'

const CHAVE_TECNICO = 'smartlar.agenda.tecnico'

// Lembra o técnico escolhido neste aparelho (cada técnico abre direto na sua agenda).
function tecnicoSalvo() {
  try {
    return localStorage.getItem(CHAVE_TECNICO) ?? ''
  } catch {
    return ''
  }
}

function salvarTecnico(id: string) {
  try {
    localStorage.setItem(CHAVE_TECNICO, id)
  } catch {
    // Sem armazenamento local (ex.: aba anônima): só não lembra a escolha.
  }
}

function rotuloDia(chave: string, iso: string) {
  if (chave === chaveDiaRelativa(0)) return 'Hoje'
  if (chave === chaveDiaRelativa(1)) return 'Amanhã'
  const texto = formatarDiaSemana(iso)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

type Acao = { pedido: PedidoDetalhado; status: 'em_andamento' | 'concluido' }

export default function Agenda() {
  const tecnicosQ = useCarregar(() =>
    dados(supabase.from('tecnicos').select('id, nome, especialidade').eq('ativo', true).order('nome')),
  )
  const [escolhido, setEscolhido] = useState(tecnicoSalvo)
  const tecnicos = tecnicosQ.data ?? []
  const tecnico = tecnicos.find((t) => t.id === escolhido) ?? tecnicos[0]

  const agendaQ = useCarregar(
    async () =>
      tecnico
        ? ((await dados(
            supabase
              .from('vw_pedidos_detalhados')
              .select('*')
              .eq('tecnico_id', tecnico.id)
              .in('status', ['agendado', 'em_andamento'])
              .order('data_instalacao'),
          )) as PedidoDetalhado[])
        : [],
    [tecnico?.id],
  )

  const [acao, setAcao] = useState<Acao | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function confirmarAcao() {
    if (!acao) return
    setSalvando(true)
    const { error } = await supabase.from('pedidos').update({ status: acao.status }).eq('id', acao.pedido.id)
    setSalvando(false)
    if (error) return toastErro(error, 'Não foi possível atualizar a instalação')
    toast.success(acao.status === 'em_andamento' ? 'Instalação iniciada' : 'Instalação concluída')
    setAcao(null)
    agendaQ.recarregar()
  }

  // Agrupa por dia (fuso de Brasília), mantendo a ordem por horário.
  const hoje = chaveDiaRelativa(0)
  const dias = new Map<string, PedidoDetalhado[]>()
  for (const p of agendaQ.data ?? []) {
    const chave = chaveDia(p.data_instalacao!)
    dias.set(chave, [...(dias.get(chave) ?? []), p])
  }

  return (
    <>
      <PageHeader titulo="Agenda" descricao="Instalações agendadas e em andamento por técnico." />

      {tecnicosQ.carregando && !tecnicosQ.data ? (
        <Card><LoadingState /></Card>
      ) : tecnicosQ.erro ? (
        <Card><ErrorState mensagem={tecnicosQ.erro} onTentarNovamente={tecnicosQ.recarregar} /></Card>
      ) : tecnicos.length === 0 ? (
        <Card><EmptyState titulo="Nenhum técnico ativo cadastrado" /></Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-2 sm:flex">
            {tecnicos.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setEscolhido(t.id)
                  salvarTecnico(t.id)
                }}
                className={cx(
                  'rounded-xl px-4 py-3 text-left ring-1 ring-inset transition-colors sm:min-w-48',
                  t.id === tecnico?.id ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                )}
              >
                <p className="font-semibold">{t.nome}</p>
                <p className={cx('text-xs', t.id === tecnico?.id ? 'text-teal-50' : 'text-slate-500')}>{t.especialidade}</p>
              </button>
            ))}
          </div>

          {agendaQ.carregando && dias.size === 0 ? (
            <Card><LoadingState /></Card>
          ) : agendaQ.erro ? (
            <Card><ErrorState mensagem={agendaQ.erro} onTentarNovamente={agendaQ.recarregar} /></Card>
          ) : dias.size === 0 ? (
            <Card>
              <EmptyState titulo="Nenhuma instalação pendente" descricao={`${tecnico?.nome} não tem instalações agendadas no momento.`} />
            </Card>
          ) : (
            <div className="space-y-8">
              {[...dias.entries()].map(([chave, pedidos]) => {
                const atrasado = chave < hoje
                return (
                  <section key={chave}>
                    <h2 className={cx('mb-3 text-sm font-semibold', atrasado ? 'text-red-600' : 'text-slate-900')}>
                      {atrasado && 'Atrasado · '}
                      {rotuloDia(chave, pedidos[0].data_instalacao!)}
                      <span className="ml-2 font-normal text-slate-400">{pedidos.length} instalação(ões)</span>
                    </h2>
                    <div className="space-y-3">
                      {pedidos.map((p) => (
                        <Card key={p.id} className={cx(p.status === 'em_andamento' && 'border-orange-200 ring-1 ring-orange-100')}>
                          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
                            <div className="flex items-center gap-3 sm:w-24 sm:flex-col sm:items-start sm:gap-1">
                              <p className="text-2xl font-semibold tabular-nums text-slate-900">{formatarHora(p.data_instalacao)}</p>
                              <StatusBadge status={p.status} />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-base font-semibold text-slate-900">{p.cliente_nome}</p>
                                <Link to={`/pedidos/${p.id}`} className="shrink-0 text-xs text-slate-400 hover:text-teal-700">
                                  #{p.numero}
                                </Link>
                              </div>
                              <a href={linkMapa(p.cliente_endereco)} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-slate-600 hover:text-teal-700">
                                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {p.cliente_endereco}
                              </a>
                              <a href={linkWhatsApp(p.cliente_telefone)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-600 hover:text-teal-700">
                                <MessageCircle className="size-4 text-slate-400" /> {formatarTelefone(p.cliente_telefone)}
                              </a>
                              {p.observacoes && <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{p.observacoes}</p>}
                            </div>
                            <div className="sm:w-44">
                              {p.status === 'agendado' ? (
                                <Button tamanho="lg" className="w-full" icone={<CirclePlay className="size-5" />} onClick={() => setAcao({ pedido: p, status: 'em_andamento' })}>
                                  Iniciar
                                </Button>
                              ) : (
                                <Button
                                  tamanho="lg"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                                  icone={<CircleCheck className="size-5" />}
                                  onClick={() => setAcao({ pedido: p, status: 'concluido' })}
                                >
                                  Concluir
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {acao && (
        <ConfirmModal
          titulo={acao.status === 'em_andamento' ? 'Iniciar instalação' : 'Concluir instalação'}
          mensagem={
            acao.status === 'em_andamento'
              ? `Iniciar a instalação do pedido #${acao.pedido.numero} (${acao.pedido.cliente_nome})?`
              : `Confirmar que a instalação do pedido #${acao.pedido.numero} (${acao.pedido.cliente_nome}) foi concluída?`
          }
          rotuloConfirmar={acao.status === 'em_andamento' ? 'Iniciar' : 'Concluir'}
          carregando={salvando}
          onFechar={() => setAcao(null)}
          onConfirmar={confirmarAcao}
        />
      )}
    </>
  )
}
