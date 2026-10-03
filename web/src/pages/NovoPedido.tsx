import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { MapPin, Plus, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Constants } from '../lib/database.types'
import { dados, useCarregar } from '../lib/hooks'
import { toastErro } from '../lib/errors'
import { CATEGORIA_LABEL, centavos, formatarBRL, formatarTelefone } from '../lib/format'
import { ClienteModal } from '../components/ClienteModal'
import {
  Button, Card, ErrorState, Field, LoadingState, PageHeader, SectionTitle, cx, inputCls, inputErroCls,
} from '../components/ui'

type Linha = { chave: number; produtoId: string; quantidade: string }

const CATEGORIAS = Constants.public.Enums.categoria_produto

export default function NovoPedido() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const { data, carregando, erro, recarregar } = useCarregar(async () => {
    const [clientes, produtos] = await Promise.all([
      dados(supabase.from('clientes').select('id, nome, telefone, endereco').order('nome')),
      dados(supabase.from('produtos').select('*').eq('ativo', true).order('nome')),
    ])
    return { clientes, produtos }
  })

  const [clienteId, setClienteId] = useState(params.get('cliente') ?? '')
  const [linhas, setLinhas] = useState<Linha[]>([{ chave: 1, produtoId: '', quantidade: '1' }])
  const [observacoes, setObservacoes] = useState('')
  const [erroCliente, setErroCliente] = useState<string | null>(null)
  const [errosLinhas, setErrosLinhas] = useState<Record<number, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false)
  const proximaChave = useRef(2)

  if (carregando && !data) return <Card><LoadingState /></Card>
  if (erro || !data) return <Card><ErrorState mensagem={erro ?? 'Erro ao carregar.'} onTentarNovamente={recarregar} /></Card>

  const produtosPorId = new Map(data.produtos.map((p) => [p.id, p]))
  const cliente = data.clientes.find((c) => c.id === clienteId)

  const quantidadeValida = (q: string) => /^\d+$/.test(q) && Number(q) > 0
  // Subtotal em centavos: 2 x R$ 450,00 = 90000 centavos, sem erro de arredondamento.
  const subtotal = (l: Linha) => {
    const produto = produtosPorId.get(l.produtoId)
    return produto && quantidadeValida(l.quantidade) ? centavos(produto.preco_unitario) * Number(l.quantidade) : 0
  }
  const totalCentavos = linhas.reduce((soma, l) => soma + subtotal(l), 0)
  const qtdItens = linhas.reduce((soma, l) => soma + (l.produtoId && quantidadeValida(l.quantidade) ? Number(l.quantidade) : 0), 0)

  function alterarLinha(chave: number, mudanca: Partial<Linha>) {
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...mudanca } : l)))
    setErrosLinhas((atual) => ({ ...atual, [chave]: '' }))
  }

  function adicionarLinha() {
    setLinhas((atual) => [...atual, { chave: proximaChave.current++, produtoId: '', quantidade: '1' }])
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const novosErros: Record<number, string> = {}
    for (const l of linhas) {
      if (!l.produtoId) novosErros[l.chave] = 'Selecione o produto ou remova a linha.'
      else if (!quantidadeValida(l.quantidade)) novosErros[l.chave] = 'A quantidade deve ser um número inteiro maior que zero.'
    }
    setErrosLinhas(novosErros)
    setErroCliente(clienteId ? null : 'Selecione o cliente.')
    if (!clienteId || Object.keys(novosErros).length > 0) {
      toast.error('Confira os campos destacados')
      return
    }

    setSalvando(true)
    const { data: pedidoId, error } = await supabase.rpc('criar_pedido', {
      p_cliente_id: clienteId,
      p_itens: linhas.map((l) => ({ produto_id: l.produtoId, quantidade: Number(l.quantidade) })),
      p_observacoes: observacoes.trim() || undefined,
    })
    setSalvando(false)
    if (error) return toastErro(error, 'Não foi possível salvar o orçamento')
    toast.success('Orçamento criado', { description: `Total de ${formatarBRL(totalCentavos / 100)}` })
    navigate(`/pedidos/${pedidoId}`)
  }

  return (
    <>
      <PageHeader titulo="Novo pedido" descricao="Monte o orçamento: ele é salvo com status Orçamento." />

      <form onSubmit={salvar} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-6">
          {/* Cliente */}
          <Card>
            <SectionTitle>1. Cliente</SectionTitle>
            <div className="space-y-3 p-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label="Cliente"
                  className={cx(inputCls, 'flex-1', erroCliente && inputErroCls)}
                  value={clienteId}
                  onChange={(e) => {
                    setClienteId(e.target.value)
                    setErroCliente(null)
                  }}
                >
                  <option value="">Selecione o cliente…</option>
                  {data.clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} — {formatarTelefone(c.telefone)}
                    </option>
                  ))}
                </select>
                <Button variante="secondary" icone={<UserPlus className="size-4" />} onClick={() => setCadastrandoCliente(true)}>
                  Cadastrar novo
                </Button>
              </div>
              {erroCliente && <p className="text-xs text-red-600">{erroCliente}</p>}
              {cliente && (
                <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <span><span className="font-medium text-slate-700">Instalação:</span> {cliente.endereco}</span>
                </p>
              )}
            </div>
          </Card>

          {/* Itens */}
          <Card>
            <SectionTitle>2. Produtos</SectionTitle>
            <div className="divide-y divide-slate-100">
              {linhas.map((linha, indice) => {
                const produto = produtosPorId.get(linha.produtoId)
                const usadosEmOutras = new Set(linhas.filter((l) => l.chave !== linha.chave).map((l) => l.produtoId))
                const erroLinha = errosLinhas[linha.chave]
                return (
                  <div key={linha.chave} className="px-5 py-4">
                    <div className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_88px_110px_auto] sm:items-end">
                      <Field label={`Produto ${indice + 1}`} className="col-span-2 sm:col-span-1">
                        <select
                          className={cx(inputCls, erroLinha && !linha.produtoId && inputErroCls)}
                          value={linha.produtoId}
                          onChange={(e) => alterarLinha(linha.chave, { produtoId: e.target.value })}
                        >
                          <option value="">Selecione…</option>
                          {CATEGORIAS.map((categoria) => (
                            <optgroup key={categoria} label={CATEGORIA_LABEL[categoria]}>
                              {data.produtos
                                .filter((p) => p.categoria === categoria)
                                .map((p) => (
                                  <option key={p.id} value={p.id} disabled={usadosEmOutras.has(p.id)}>
                                    {p.nome} — {formatarBRL(p.preco_unitario)}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                      </Field>
                      <Field label="Qtd.">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          className={cx(inputCls, erroLinha && linha.produtoId && inputErroCls)}
                          value={linha.quantidade}
                          onChange={(e) => alterarLinha(linha.chave, { quantidade: e.target.value })}
                        />
                      </Field>
                      <div className="text-right sm:pb-2">
                        <p className="text-xs text-slate-500">
                          {produto ? `${formatarBRL(produto.preco_unitario)} un.` : 'Subtotal'}
                        </p>
                        <p className="font-semibold tabular-nums text-slate-900">{formatarBRL(subtotal(linha) / 100)}</p>
                      </div>
                      <Button
                        variante="ghost"
                        className="self-end"
                        aria-label="Remover produto"
                        disabled={linhas.length === 1}
                        onClick={() => setLinhas((atual) => atual.filter((l) => l.chave !== linha.chave))}
                        icone={<Trash2 className="size-4" />}
                      />
                    </div>
                    {erroLinha && <p className="mt-1.5 text-xs text-red-600">{erroLinha}</p>}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <Button
                variante="secondary"
                tamanho="sm"
                icone={<Plus className="size-4" />}
                onClick={adicionarLinha}
                disabled={linhas.length >= data.produtos.length}
              >
                Adicionar produto
              </Button>
            </div>
          </Card>

          {/* Observações */}
          <Card>
            <SectionTitle>3. Observações</SectionTitle>
            <div className="p-5">
              <textarea
                rows={3}
                aria-label="Observações"
                placeholder='Ex.: "Portão eletrônico antigo, verificar compatibilidade"'
                className={inputCls}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </Card>
        </div>

        {/* Resumo */}
        <Card className="lg:sticky lg:top-8">
          <SectionTitle>Resumo</SectionTitle>
          <div className="space-y-4 p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Cliente</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-slate-900">{cliente?.nome ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Itens</dt>
                <dd className="font-medium text-slate-900">{qtdItens}</dd>
              </div>
            </dl>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">Valor total</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
                {formatarBRL(totalCentavos / 100)}
              </p>
            </div>
            <Button type="submit" tamanho="lg" className="w-full" carregando={salvando}>
              Salvar orçamento
            </Button>
          </div>
        </Card>
      </form>

      {cadastrandoCliente && (
        <ClienteModal
          onFechar={() => setCadastrandoCliente(false)}
          onSalvo={(novo) => {
            setCadastrandoCliente(false)
            setClienteId(novo.id)
            setErroCliente(null)
            recarregar()
          }}
        />
      )}
    </>
  )
}
