import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Constants } from '../lib/database.types'
import { dados, useCarregar } from '../lib/hooks'
import { STATUS_LABEL, formatarBRL, formatarData, formatarDataHora, normalizarBusca } from '../lib/format'
import type { PedidoDetalhado, Status } from '../lib/types'
import {
  Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, cx, inputCls,
} from '../components/ui'

const STATUS = Constants.public.Enums.status_pedido

export default function Pedidos() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const parametro = params.get('status')
  const filtro = STATUS.find((s) => s === parametro) ?? null
  const [busca, setBusca] = useState('')

  const { data: pedidos, carregando, erro, recarregar } = useCarregar(
    () =>
      dados(supabase.from('vw_pedidos_detalhados').select('*').order('numero', { ascending: false })) as Promise<
        PedidoDetalhado[]
      >,
  )

  const contagem = (status: Status | null) =>
    (pedidos ?? []).filter((p) => status === null || p.status === status).length

  const termo = normalizarBusca(busca.trim().replace(/^#/, ''))
  const visiveis = (pedidos ?? []).filter(
    (p) =>
      (filtro === null || p.status === filtro) &&
      (!termo || normalizarBusca(p.cliente_nome).includes(termo) || String(p.numero).includes(termo)),
  )

  function escolherFiltro(status: Status | null) {
    setParams(status ? { status } : {}, { replace: true })
  }

  return (
    <>
      <PageHeader
        titulo="Pedidos"
        descricao="Todos os orçamentos e pedidos, do orçamento à conclusão."
        acoes={
          <Button icone={<Plus className="size-4" />} onClick={() => navigate('/pedidos/novo')}>
            Novo pedido
          </Button>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {[null, ...STATUS].map((status) => (
            <button
              key={status ?? 'todos'}
              onClick={() => escolherFiltro(status)}
              className={cx(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
                filtro === status
                  ? 'bg-teal-600 text-white ring-teal-600'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {status ? STATUS_LABEL[status] : 'Todos'}
              <span
                className={cx(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  filtro === status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {contagem(status)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar por cliente ou nº do pedido"
              className={`${inputCls} pl-9`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {carregando && !pedidos ? (
          <LoadingState />
        ) : erro ? (
          <ErrorState mensagem={erro} onTentarNovamente={recarregar} />
        ) : visiveis.length === 0 ? (
          <EmptyState
            titulo="Nenhum pedido encontrado"
            descricao={filtro ? `Não há pedidos com status "${STATUS_LABEL[filtro]}".` : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Pedido</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="hidden px-5 py-3 md:table-cell">Técnico / instalação</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiveis.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/pedidos/${p.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">#{p.numero}</p>
                      <p className="text-xs text-slate-500">{formatarData(p.created_at)}</p>
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-3.5 text-slate-700">{p.cliente_nome}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                    <td className="hidden px-5 py-3.5 md:table-cell">
                      {p.tecnico_nome ? (
                        <>
                          <p className="text-slate-700">{p.tecnico_nome}</p>
                          <p className="text-xs text-slate-500">{formatarDataHora(p.data_instalacao)}</p>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium tabular-nums text-slate-900">{formatarBRL(p.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
