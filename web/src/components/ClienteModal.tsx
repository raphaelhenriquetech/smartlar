import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { toastErro } from '../lib/errors'
import { formatarTelefone, somenteDigitos } from '../lib/format'
import type { Cliente } from '../lib/types'
import { Button, Field, Modal, cx, inputCls, inputErroCls } from './ui'

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Cadastro de cliente (usado na tela de clientes e no novo pedido).
export function ClienteModal({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: (cliente: Cliente) => void }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const digitos = somenteDigitos(telefone)
    const novosErros: Record<string, string> = {}
    if (!nome.trim()) novosErros.nome = 'Informe o nome.'
    if (digitos.length < 10 || digitos.length > 13) novosErros.telefone = 'Informe DDD + número (ex.: (11) 98765-4321).'
    if (email.trim() && !EMAIL_VALIDO.test(email.trim())) novosErros.email = 'E-mail inválido.'
    if (!endereco.trim()) novosErros.endereco = 'Informe o endereço da instalação.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setSalvando(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nome: nome.trim(),
        telefone: digitos, // salvo só com dígitos; a máscara é só visual
        email: email.trim().toLowerCase() || null,
        endereco: endereco.trim(),
      })
      .select()
      .single()
    setSalvando(false)
    if (error) return toastErro(error)
    toast.success(`Cliente ${data.nome} cadastrado`)
    onSalvo(data)
  }

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
        <Field label="Endereço da instalação" htmlFor="c-endereco" obrigatorio erro={erros.endereco}>
          <textarea
            id="c-endereco"
            rows={2}
            placeholder="Rua, número, complemento - bairro, cidade/UF"
            className={cx(inputCls, erros.endereco && inputErroCls)}
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
