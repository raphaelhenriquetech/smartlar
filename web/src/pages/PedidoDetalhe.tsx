import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft, Ban, CalendarDays, CircleCheck, CirclePlay, MapPin, MessageCircle, Trash2, type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Constants } from '../lib/database.types'
import { dados, useCarregar } from '../lib/hooks'
import { toastErro } from '../lib/errors'
import {
  PAGAMENTO_LABEL, STATUS_LABEL, datetimeLocalParaISO, formatarBRL, formatarDataHora, formatarTelefone,
  linkMapa, linkWhatsApp, sugestaoAgendamento,
} from '../lib/format'
import type { FormaPagamento, PedidoDetalhado, Status } from '../lib/types'
import {
  Button, Card, ConfirmModal, EmptyState, ErrorState, Field, LoadingState, Modal, SectionTitle, StatusBadge,
  cx, inputCls, inputErroCls,
} from '../components/ui'

// Botão de cada próximo status possível (a lista vem de proximos_status() no banco).
const ACOES: Partial<Record<Status, { rotulo: string; icone: LucideIcon; perigoso?: boolean }>> = {
  aprovado: { rotulo: 'Aprovar', icone: CircleCheck },
  agendado: { rotulo: 'Agendar instalação', icone: CalendarDays },
  em_andamento: { rotulo: 'Iniciar instalação', icone: CirclePlay },
  concluido: { rotulo: 'Concluir', icone: CircleCheck },
  cancelado: { rotulo: 'Cancelar pedido', icone: Ban, perigoso: true },
}

export default function PedidoDetalhe() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [acao, setAcao] = useState<Status | 'excluir' | null>(null)
  const [salvando, setSalvando] = useState(false)

  const { data, carregando, erro, recarregar } = useCarregar(async () => {
    const [pedido, itens, historico] = await Promise.all([
      supabase
        .from('vw_pedidos_detalhados')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then(({ data: linha, error }) => {
          if (error) throw error
          return linha as PedidoDetalhado | null
        }),
      dados(
        supabase
          .from('itens_pedido')
          .select('id, quantidade, preco_unitario, subtotal, produtos(nome)')
          .eq('pedido_id', id)
          .order('subtotal', { ascending: false }),
      ),
      dados(supabase.from('historico_status').select('*').eq('pedido_id', id).order('alterado_em')),
    ])
    const proximos = pedido?.status ? await dados(supabase.rpc('proximos_status', { p_status: pedido.status })) : []
    return { pedido, itens, historico, proximos }
  }, [id])

  async function atualizar(mudanca: {
    status: Status
    forma_pagamento?: FormaPagamento
    tecnico_id?: string
    data_instalacao?: string
  }) {
    setSalvando(true)
    const { error } = await supabase.from('pedidos').update(mudanca).eq('id', id)
    setSalvando(false)
    if (error) return toastErro(error, 'Não foi possível alterar o status')
    toast.success(`Pedido agora está "${STATUS_LABEL[mudanca.status]}"`)
    setAcao(null)
    recarregar()
  }

  async function excluir() {
    setSalvando(true)
    const { error } = await supabase.from('pedidos').delete().eq('id', id)
    setSalvando(false)
    if (error) return toastErro(error, 'Não foi possível excluir')
    toast.success('Orçamento excluído')
    navigate('/pedidos', { replace: true })
  }

  if (carregando && !data) return <Card><LoadingState /></Card>
  if (erro) return <Card><ErrorState mensagem={erro} onTentarNovamente={recarregar} /></Card>
  if (!data?.pedido) {
    return (
      <Card>
        <EmptyState
          titulo="Pedido não encontrado"
          acao={<Button variante="secondary" onClick={() => navigate('/pedidos')}>Ver pedidos</Button>}
        />
      </Card>
    )
  }

  const { pedido, itens, historico, proximos } = data

  return (
    <>
      <Link to="/pedidos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Pedidos
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pedido #{pedido.numero}</h1>
            <StatusBadge status={pedido.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Criado em {formatarDataHora(pedido.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {proximos.map((status) => {
            const config = ACOES[status]
            if (!config) return null
            const Icone = config.icone
            return (
              <Button
                key={status}
                variante={config.perigoso ? 'secondary' : 'primary'}
                className={config.perigoso ? 'text-red-600' : undefined}
                icone={<Icone className="size-4" />}
                onClick={() => setAcao(status)}
              >
                {config.rotulo}
              </Button>
            )
          })}
          {pedido.status === 'orcamento' && (
            <Button variante="ghost" className="text-red-600" icone={<Trash2 className="size-4" />} onClick={() => setAcao('excluir')}>
              Excluir
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle>Itens</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5">Produto</th>
                    <th className="px-5 py-2.5 text-right">Qtd.</th>
                    <th className="px-5 py-2.5 text-right">Preço un.</th>
                    <th className="px-5 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3 text-slate-800">{item.produtos?.nome}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{item.quantidade}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatarBRL(item.preco_unitario)}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-900">{formatarBRL(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={3} className="px-5 py-3 text-right font-medium text-slate-600">Total</td>
                    <td className="px-5 py-3 text-right text-lg font-semibold tabular-nums text-slate-900">
                      {formatarBRL(pedido.valor_total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle>Observações</SectionTitle>
            <p className="whitespace-pre-wrap px-5 py-4 text-sm text-slate-600">{pedido.observacoes || '—'}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Cliente</SectionTitle>
            <div className="space-y-2 px-5 py-4 text-sm">
              <p className="font-medium text-slate-900">{pedido.cliente_nome}</p>
              <a href={linkWhatsApp(pedido.cliente_telefone)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-600 hover:text-teal-700">
                <MessageCircle className="size-4 text-slate-400" /> {formatarTelefone(pedido.cliente_telefone)}
              </a>
              <a href={linkMapa(pedido.cliente_endereco)} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-slate-600 hover:text-teal-700">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {pedido.cliente_endereco}
              </a>
            </div>
          </Card>

          <Card>
            <SectionTitle>Instalação e pagamento</SectionTitle>
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Info rotulo="Técnico" valor={pedido.tecnico_nome} />
              <Info rotulo="Data e hora" valor={pedido.data_instalacao ? formatarDataHora(pedido.data_instalacao) : null} />
              <Info rotulo="Forma de pagamento" valor={pedido.forma_pagamento ? PAGAMENTO_LABEL[pedido.forma_pagamento] : null} />
              {pedido.concluido_em && <Info rotulo="Concluído em" valor={formatarDataHora(pedido.concluido_em)} />}
            </dl>
          </Card>

          <Card>
            <SectionTitle>Histórico</SectionTitle>
            <ol className="space-y-4 px-5 py-4">
              {historico.map((h, i) => (
                <li key={h.id} className="relative flex gap-3">
                  {i < historico.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
                  <span className={cx('mt-1.5 size-[11px] shrink-0 rounded-full ring-2 ring-white', i === historico.length - 1 ? 'bg-teal-600' : 'bg-slate-300')} />
                  <div className="text-sm">
                    <p className="text-slate-800">
                      {h.status_anterior
                        ? `${STATUS_LABEL[h.status_anterior]} → ${STATUS_LABEL[h.status_novo]}`
                        : `Criado como ${STATUS_LABEL[h.status_novo]}`}
                    </p>
                    <p className="text-xs text-slate-500">{formatarDataHora(h.alterado_em)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {acao === 'aprovado' && (
        <AprovarModal salvando={salvando} onFechar={() => setAcao(null)} onConfirmar={(forma) => atualizar({ status: 'aprovado', forma_pagamento: forma })} />
      )}
      {acao === 'agendado' && (
        <AgendarModal
          salvando={salvando}
          onFechar={() => setAcao(null)}
          onConfirmar={(tecnicoId, dataISO) => atualizar({ status: 'agendado', tecnico_id: tecnicoId, data_instalacao: dataISO })}
        />
      )}
      {acao === 'em_andamento' && (
        <ConfirmModal
          titulo="Iniciar instalação"
          mensagem={`Marcar o pedido #${pedido.numero} como "Em andamento"?`}
          rotuloConfirmar="Iniciar"
          carregando={salvando}
          onFechar={() => setAcao(null)}
          onConfirmar={() => atualizar({ status: 'em_andamento' })}
        />
      )}
      {acao === 'concluido' && (
        <ConfirmModal
          titulo="Concluir pedido"
          mensagem={`Confirmar a conclusão do pedido #${pedido.numero}? O valor de ${formatarBRL(pedido.valor_total)} entra no faturamento.`}
          rotuloConfirmar="Concluir"
          carregando={salvando}
          onFechar={() => setAcao(null)}
          onConfirmar={() => atualizar({ status: 'concluido' })}
        />
      )}
      {acao === 'cancelado' && (
        <ConfirmModal
          titulo="Cancelar pedido"
          mensagem={`O pedido #${pedido.numero} será cancelado. Essa ação não pode ser desfeita.`}
          rotuloConfirmar="Cancelar pedido"
          perigoso
          carregando={salvando}
          onFechar={() => setAcao(null)}
          onConfirmar={() => atualizar({ status: 'cancelado' })}
        />
      )}
      {acao === 'excluir' && (
        <ConfirmModal
          titulo="Excluir orçamento"
          mensagem={`O orçamento #${pedido.numero} e seus itens serão apagados definitivamente.`}
          rotuloConfirmar="Excluir"
          perigoso
          carregando={salvando}
          onFechar={() => setAcao(null)}
          onConfirmar={excluir}
        />
      )}
    </>
  )
}

function Info({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className={cx('text-right', valor ? 'font-medium text-slate-900' : 'text-slate-400')}>{valor || 'Não definido'}</dd>
    </div>
  )
}

function AprovarModal({
  salvando, onFechar, onConfirmar,
}: {
  salvando: boolean
  onFechar: () => void
  onConfirmar: (forma: FormaPagamento) => void
}) {
  const [forma, setForma] = useState<FormaPagamento | ''>('')
  const [erro, setErro] = useState<string | null>(null)

  function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!forma) return setErro('Escolha a forma de pagamento combinada com o cliente.')
    onConfirmar(forma)
  }

  return (
    <Modal
      aberto
      titulo="Aprovar orçamento"
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar}>Voltar</Button>
          <Button type="submit" form="form-aprovar" carregando={salvando}>Aprovar</Button>
        </>
      }
    >
      <form id="form-aprovar" onSubmit={confirmar} noValidate>
        <Field label="Forma de pagamento" htmlFor="forma" obrigatorio erro={erro}>
          <select
            id="forma"
            className={cx(inputCls, erro && inputErroCls)}
            value={forma}
            onChange={(e) => {
              setForma(e.target.value as FormaPagamento)
              setErro(null)
            }}
          >
            <option value="">Selecione…</option>
            {Constants.public.Enums.forma_pagamento.map((f) => (
              <option key={f} value={f}>{PAGAMENTO_LABEL[f]}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  )
}

function AgendarModal({
  salvando, onFechar, onConfirmar,
}: {
  salvando: boolean
  onFechar: () => void
  onConfirmar: (tecnicoId: string, dataISO: string) => void
}) {
  const { data: tecnicos, carregando } = useCarregar(() =>
    dados(supabase.from('tecnicos').select('id, nome, especialidade').eq('ativo', true).order('nome')),
  )
  const [tecnicoId, setTecnicoId] = useState('')
  const [quando, setQuando] = useState(sugestaoAgendamento())
  const [erros, setErros] = useState<{ tecnico?: string; quando?: string }>({})

  function confirmar(e: FormEvent) {
    e.preventDefault()
    const novosErros: typeof erros = {}
    if (!tecnicoId) novosErros.tecnico = 'Escolha o técnico responsável.'
    if (!quando) novosErros.quando = 'Informe a data e a hora.'
    else if (new Date(datetimeLocalParaISO(quando)).getTime() < Date.now()) novosErros.quando = 'Escolha uma data futura.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return
    onConfirmar(tecnicoId, datetimeLocalParaISO(quando))
  }

  return (
    <Modal
      aberto
      titulo="Agendar instalação"
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar}>Voltar</Button>
          <Button type="submit" form="form-agendar" carregando={salvando}>Agendar</Button>
        </>
      }
    >
      <form id="form-agendar" onSubmit={confirmar} className="space-y-4" noValidate>
        <Field label="Técnico" htmlFor="tecnico" obrigatorio erro={erros.tecnico}>
          <select
            id="tecnico"
            className={cx(inputCls, erros.tecnico && inputErroCls)}
            value={tecnicoId}
            disabled={carregando}
            onChange={(e) => setTecnicoId(e.target.value)}
          >
            <option value="">{carregando ? 'Carregando…' : 'Selecione…'}</option>
            {(tecnicos ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.nome} — {t.especialidade}</option>
            ))}
          </select>
        </Field>
        <Field label="Data e hora (horário de Brasília)" htmlFor="quando" obrigatorio erro={erros.quando}>
          <input
            id="quando"
            type="datetime-local"
            className={cx(inputCls, erros.quando && inputErroCls)}
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
