import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Constants } from '../lib/database.types'
import { dados, useCarregar } from '../lib/hooks'
import { toastErro } from '../lib/errors'
import { CATEGORIA_LABEL, formatarBRL } from '../lib/format'
import type { Categoria, Produto } from '../lib/types'
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, SectionTitle,
  cx, inputCls, inputErroCls,
} from '../components/ui'

const CATEGORIAS = Constants.public.Enums.categoria_produto

export default function Produtos() {
  const { data: produtos, carregando, erro, recarregar } = useCarregar(() =>
    dados(supabase.from('produtos').select('*').order('nome')),
  )
  const [mostrarInativos, setMostrarInativos] = useState(true)
  const [emEdicao, setEmEdicao] = useState<Produto | 'novo' | null>(null)
  const [alternando, setAlternando] = useState<string | null>(null)

  async function alternarAtivo(produto: Produto) {
    setAlternando(produto.id)
    const { error } = await supabase.from('produtos').update({ ativo: !produto.ativo }).eq('id', produto.id)
    setAlternando(null)
    if (error) return toastErro(error)
    toast.success(produto.ativo ? `"${produto.nome}" foi desativado` : `"${produto.nome}" foi reativado`)
    recarregar()
  }

  const visiveis = (produtos ?? []).filter((p) => mostrarInativos || p.ativo)

  return (
    <>
      <PageHeader
        titulo="Produtos"
        descricao="Catálogo de equipamentos vendidos e instalados pela SmartLar."
        acoes={
          <Button icone={<Plus className="size-4" />} onClick={() => setEmEdicao('novo')}>
            Novo produto
          </Button>
        }
      />

      <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          className="size-4 rounded border-slate-300 accent-teal-600"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.target.checked)}
        />
        Mostrar produtos inativos
      </label>

      {carregando && !produtos ? (
        <Card><LoadingState /></Card>
      ) : erro ? (
        <Card><ErrorState mensagem={erro} onTentarNovamente={recarregar} /></Card>
      ) : (
        <div className="space-y-6">
          {CATEGORIAS.map((categoria) => {
            const itens = visiveis.filter((p) => p.categoria === categoria)
            return (
              <Card key={categoria}>
                <SectionTitle acao={<span className="text-xs text-slate-500">{itens.length} produto(s)</span>}>
                  {CATEGORIA_LABEL[categoria]}
                </SectionTitle>
                {itens.length === 0 ? (
                  <EmptyState titulo="Nenhum produto nesta categoria" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {itens.map((p) => (
                      <li
                        key={p.id}
                        className={cx('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center', !p.ativo && 'opacity-60')}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{p.nome}</p>
                            {!p.ativo && <Badge className="bg-slate-100 text-slate-500 ring-slate-500/20">Inativo</Badge>}
                          </div>
                          {p.descricao && <p className="mt-0.5 text-sm text-slate-500">{p.descricao}</p>}
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <p className="font-semibold tabular-nums text-slate-900">{formatarBRL(p.preco_unitario)}</p>
                          <div className="flex gap-1">
                            <Button variante="ghost" tamanho="sm" icone={<Pencil className="size-4" />} onClick={() => setEmEdicao(p)}>
                              Editar
                            </Button>
                            <Button
                              variante="ghost"
                              tamanho="sm"
                              carregando={alternando === p.id}
                              onClick={() => alternarAtivo(p)}
                            >
                              {p.ativo ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {emEdicao && (
        <ProdutoModal
          produto={emEdicao === 'novo' ? null : emEdicao}
          onFechar={() => setEmEdicao(null)}
          onSalvo={() => {
            setEmEdicao(null)
            recarregar()
          }}
        />
      )}
    </>
  )
}

function ProdutoModal({
  produto, onFechar, onSalvo,
}: {
  produto: Produto | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [categoria, setCategoria] = useState<Categoria | ''>(produto?.categoria ?? '')
  const [preco, setPreco] = useState(produto ? String(produto.preco_unitario) : '')
  const [descricao, setDescricao] = useState(produto?.descricao ?? '')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const valorPreco = Number(preco.replace(',', '.'))
    const novosErros: Record<string, string> = {}
    if (!nome.trim()) novosErros.nome = 'Informe o nome.'
    if (!categoria) novosErros.categoria = 'Escolha a categoria.'
    if (preco.trim() === '' || !Number.isFinite(valorPreco) || valorPreco < 0) novosErros.preco = 'Informe um preço válido.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0 || !categoria) return

    const registro = {
      nome: nome.trim(),
      categoria,
      preco_unitario: Math.round(valorPreco * 100) / 100,
      descricao: descricao.trim() || null,
    }
    setSalvando(true)
    const { error } = produto
      ? await supabase.from('produtos').update(registro).eq('id', produto.id)
      : await supabase.from('produtos').insert(registro)
    setSalvando(false)
    if (error) return toastErro(error)
    toast.success(produto ? 'Produto atualizado' : 'Produto cadastrado')
    onSalvo()
  }

  return (
    <Modal
      aberto
      titulo={produto ? 'Editar produto' : 'Novo produto'}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-produto" carregando={salvando}>Salvar</Button>
        </>
      }
    >
      <form id="form-produto" onSubmit={salvar} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="p-nome" obrigatorio erro={erros.nome}>
          <input id="p-nome" className={cx(inputCls, erros.nome && inputErroCls)} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" htmlFor="p-categoria" obrigatorio erro={erros.categoria}>
            <select
              id="p-categoria"
              className={cx(inputCls, erros.categoria && inputErroCls)}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
            >
              <option value="">Selecione…</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Preço unitário (R$)"
            htmlFor="p-preco"
            obrigatorio
            erro={erros.preco}
            dica={produto ? 'Não altera pedidos já criados.' : undefined}
          >
            <input
              id="p-preco"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={cx(inputCls, erros.preco && inputErroCls)}
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Descrição" htmlFor="p-descricao">
          <textarea id="p-descricao" rows={3} className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
