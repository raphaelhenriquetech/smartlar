import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { toastErro } from '../lib/errors'
import { buscarCep } from '../lib/cep'
import { formatarCep, formatarTelefone, somenteDigitos } from '../lib/format'
import type { Cliente } from '../lib/types'
import { Button, Field, Modal, Spinner, cx, inputCls, inputErroCls } from './ui'

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Endereco = { cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }

const ENDERECO_VAZIO: Endereco = { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }

// O banco guarda o endereço em uma coluna de texto. Montamos sempre no mesmo
// formato: "Rua X, 123, apto 4 - Bairro, Cidade/UF, CEP 00000-000".
function montarEndereco(e: Endereco) {
  const rua = [e.rua.trim(), e.numero.trim(), e.complemento.trim()].filter(Boolean).join(', ')
  const local = [e.bairro.trim(), `${e.cidade.trim()}/${e.uf.trim().toUpperCase()}`].filter(Boolean).join(', ')
  const cep = somenteDigitos(e.cep).length === 8 ? `, CEP ${formatarCep(e.cep)}` : ''
  return `${rua} - ${local}${cep}`
}

// Cadastro de cliente (usado na tela de clientes e no novo pedido).
export function ClienteModal({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: (cliente: Cliente) => void }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState<Endereco>(ENDERECO_VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const ultimaConsulta = useRef(0)
  const cepPreenchido = useRef('')
  const numeroRef = useRef<HTMLInputElement>(null)

  const alterar = (campo: keyof Endereco, valor: string) => {
    setEndereco((atual) => ({ ...atual, [campo]: valor }))
    setErros((atual) => ({ ...atual, [campo]: '' }))
  }

  async function aoDigitarCep(valor: string) {
    const formatado = formatarCep(valor)
    alterar('cep', formatado)
    const cep = somenteDigitos(formatado)
    // Cada consulta ganha um número: respostas de consultas antigas são ignoradas.
    const consulta = ++ultimaConsulta.current
    if (cep.length !== 8 || cep === cepPreenchido.current) {
      setBuscandoCep(false)
      return
    }

    setBuscandoCep(true)
    try {
      const encontrado = await buscarCep(cep)
      if (consulta !== ultimaConsulta.current) return
      if (!encontrado) {
        setErros((atual) => ({ ...atual, cep: 'CEP não encontrado. Confira ou preencha o endereço manualmente.' }))
        return
      }
      cepPreenchido.current = cep
      setEndereco((atual) => ({ ...atual, ...encontrado }))
      setErros((atual) => ({ ...atual, cep: '', rua: '', bairro: '', cidade: '', uf: '' }))
      numeroRef.current?.focus()
    } catch {
      if (consulta === ultimaConsulta.current) {
        toast.warning('Não foi possível consultar o CEP', { description: 'Preencha o endereço manualmente.' })
      }
    } finally {
      if (consulta === ultimaConsulta.current) setBuscandoCep(false)
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const digitos = somenteDigitos(telefone)
    const cep = somenteDigitos(endereco.cep)
    const novosErros: Record<string, string> = {}
    if (!nome.trim()) novosErros.nome = 'Informe o nome.'
    if (digitos.length < 10 || digitos.length > 13) novosErros.telefone = 'Informe DDD + número (ex.: (11) 98765-4321).'
    if (email.trim() && !EMAIL_VALIDO.test(email.trim())) novosErros.email = 'E-mail inválido.'
    if (cep && cep.length !== 8) novosErros.cep = 'O CEP tem 8 dígitos.'
    if (!endereco.rua.trim()) novosErros.rua = 'Informe a rua.'
    if (!endereco.numero.trim()) novosErros.numero = 'Informe o número (ou "s/n").'
    if (!endereco.cidade.trim()) novosErros.cidade = 'Informe a cidade.'
    if (!/^[A-Za-z]{2}$/.test(endereco.uf.trim())) novosErros.uf = 'UF com 2 letras.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setSalvando(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nome: nome.trim(),
        telefone: digitos, // salvo só com dígitos; a máscara é só visual
        email: email.trim().toLowerCase() || null,
        endereco: montarEndereco(endereco),
      })
      .select()
      .single()
    setSalvando(false)
    if (error) return toastErro(error)
    toast.success(`Cliente ${data.nome} cadastrado`)
    onSalvo(data)
  }

  const campoEndereco = (campo: keyof Endereco) => cx(inputCls, erros[campo] && inputErroCls)

  return (
    <Modal
      aberto
      titulo="Novo cliente"
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" form="form-cliente" carregando={salvando}>Salvar cliente</Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={salvar} className="space-y-4" noValidate>
        <Field label="Nome" htmlFor="c-nome" obrigatorio erro={erros.nome}>
          <input id="c-nome" autoFocus className={cx(inputCls, erros.nome && inputErroCls)} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone (WhatsApp)" htmlFor="c-telefone" obrigatorio erro={erros.telefone}>
            <input
              id="c-telefone"
              type="tel"
              inputMode="numeric"
              placeholder="(11) 98765-4321"
              className={cx(inputCls, erros.telefone && inputErroCls)}
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            />
          </Field>
          <Field label="E-mail" htmlFor="c-email" erro={erros.email}>
            <input
              id="c-email"
              type="email"
              className={cx(inputCls, erros.email && inputErroCls)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>

        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Endereço da instalação</legend>
          <Field label="CEP" htmlFor="c-cep" erro={erros.cep} dica="Digite o CEP para preencher o endereço automaticamente.">
            <div className="relative sm:max-w-48">
              <input
                id="c-cep"
                inputMode="numeric"
                placeholder="00000-000"
                className={campoEndereco('cep')}
                value={endereco.cep}
                onChange={(e) => aoDigitarCep(e.target.value)}
              />
              {buscandoCep && <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2" />}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Rua" htmlFor="c-rua" obrigatorio erro={erros.rua}>
              <input id="c-rua" className={campoEndereco('rua')} value={endereco.rua} onChange={(e) => alterar('rua', e.target.value)} />
            </Field>
            <Field label="Número" htmlFor="c-numero" obrigatorio erro={erros.numero}>
              <input id="c-numero" ref={numeroRef} className={campoEndereco('numero')} value={endereco.numero} onChange={(e) => alterar('numero', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Complemento" htmlFor="c-complemento">
              <input
                id="c-complemento"
                placeholder="Apto, bloco, casa…"
                className={inputCls}
                value={endereco.complemento}
                onChange={(e) => alterar('complemento', e.target.value)}
              />
            </Field>
            <Field label="Bairro" htmlFor="c-bairro">
              <input id="c-bairro" className={inputCls} value={endereco.bairro} onChange={(e) => alterar('bairro', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-4">
            <Field label="Cidade" htmlFor="c-cidade" obrigatorio erro={erros.cidade}>
              <input id="c-cidade" className={campoEndereco('cidade')} value={endereco.cidade} onChange={(e) => alterar('cidade', e.target.value)} />
            </Field>
            <Field label="UF" htmlFor="c-uf" obrigatorio erro={erros.uf}>
              <input
                id="c-uf"
                maxLength={2}
                className={cx(campoEndereco('uf'), 'uppercase')}
                value={endereco.uf}
                onChange={(e) => alterar('uf', e.target.value.toUpperCase())}
              />
            </Field>
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
