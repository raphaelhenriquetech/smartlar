import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronRight, Mail, MapPin, MessageCircle, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dados, useCarregar } from '../lib/hooks'
import {
  formatarBRL, formatarData, formatarTelefone, linkMapa, linkWhatsApp, normalizarBusca, somenteDigitos,
} from '../lib/format'
import type { Cliente, PedidoDetalhado } from '../lib/types'
import { ClienteModal } from '../components/ClienteModal'
import {
  Button, Card, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Spinner, inputCls,
} from '../components/ui'

export default function Clientes() {
  const { data: clientes, carregando, erro, recarregar } = useCarregar(() =>
    dados(supabase.from('clientes').select('*').order('nome')),
  )
  const [busca, setBusca] = useState('')
  const [cadastrando, setCadastrando] = useState(false)
  const [selecionado, setSelecionado] = useState<Cliente | null>(null)

  const termo = normalizarBusca(busca.trim())
  const digitos = somenteDigitos(busca)
  const filtrados = (clientes ?? []).filter(
    (c) => !termo || normalizarBusca(c.nome).includes(termo) || (digitos.length > 0 && c.telefone.includes(digitos)),
  )

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="Cadastro de clientes e endereços de instalação."
        acoes={
          <Button icone={<Plus className="size-4" />} onClick={() => setCadastrando(true)}>
            Novo cliente
          </Button>
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar por nome ou telefone"
              className={`${inputCls} pl-9`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {carregando && !clientes ? (
          <LoadingState />
        ) : erro ? (
          <ErrorState mensagem={erro} onTentarNovamente={recarregar} />
        ) : filtrados.length === 0 ? (
          <EmptyState
            titulo={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            descricao={busca ? 'Tente outro nome ou número.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelecionado(c)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-0.5 md:grid-cols-[1.2fr_0.8fr_1.6fr] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{c.nome}</p>
                      {c.email && <p className="truncate text-xs text-slate-500">{c.email}</p>}
                    </div>
                    <p className="text-sm tabular-nums text-slate-600">{formatarTelefone(c.telefone)}</p>
                    <p className="truncate text-sm text-slate-500">{c.endereco}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {cadastrando && (
        <ClienteModal
          onFechar={() => setCadastrando(false)}
          onSalvo={(cliente) => {
            setCadastrando(false)
            recarregar()
            setSelecionado(cliente)
          }}
        />
      )}
      {selecionado && <ClienteDetalhe cliente={selecionado} onFechar={() => setSelecionado(null)} />}
    </>
  )
}

function ClienteDetalhe({ cliente, onFechar }: { cliente: Cliente; onFechar: () => void }) {
  const navigate = useNavigate()
  const { data: pedidos, carregando, erro, recarregar } = useCarregar(
    () =>
      dados(
        supabase
          .from('vw_pedidos_detalhados')
          .select('*')
          .eq('cliente_id', cliente.id)
          .order('numero', { ascending: false }),
      ) as Promise<PedidoDetalhado[]>,
    [cliente.id],
  )

  return (
    <Modal
      aberto
      largo
      titulo={cliente.nome}
      onFechar={onFechar}
      rodape={
        <Button icone={<Plus className="size-4" />} onClick={() => navigate(`/pedidos/novo?cliente=${cliente.id}`)}>
          Novo pedido para este cliente
        </Button>
      }
    >
      <div className="space-y-2 text-sm">
        <a href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-700 hover:text-teal-700">
          <MessageCircle className="size-4 text-slate-400" /> {formatarTelefone(cliente.telefone)}
        </a>
        {cliente.email && (
          <a href={`mailto:${cliente.email}`} className="flex items-center gap-2 text-slate-700 hover:text-teal-700">
            <Mail className="size-4 text-slate-400" /> {cliente.email}
          </a>
        )}
        <a href={linkMapa(cliente.endereco)} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-slate-700 hover:text-teal-700">
          <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" /> {cliente.endereco}
        </a>
        <p className="text-xs text-slate-500">Cliente desde {formatarData(cliente.created_at)}</p>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900">Pedidos</h3>
      <div className="rounded-lg border border-slate-200">
        {carregando && !pedidos ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : erro ? (
          <ErrorState mensagem={erro} onTentarNovamente={recarregar} />
        ) : !pedidos || pedidos.length === 0 ? (
          <EmptyState titulo="Nenhum pedido ainda" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link to={`/pedidos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="w-14 text-sm font-semibold text-slate-900">#{p.numero}</span>
                  <StatusBadge status={p.status} />
                  <span className="hidden flex-1 text-sm text-slate-500 sm:block">{formatarData(p.created_at)}</span>
                  <span className="ml-auto text-sm font-medium tabular-nums text-slate-900">{formatarBRL(p.valor_total)}</span>
                  <ChevronRight className="size-4 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
