import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { House } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { mensagemErro } from '../lib/errors'
import { useAuth } from '../auth/AuthProvider'
import { Button, Field, inputCls } from '../components/ui'

export default function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const destino = (location.state as { de?: string } | null)?.de ?? '/'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (session) return <Navigate to={destino} replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setEntrando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEntrando(false)
    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : mensagemErro(error))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/20">
            <House className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">SmartLar</h1>
          <p className="mt-1 text-sm text-slate-500">Gestão de pedidos e instalações</p>
        </div>

        <form onSubmit={entrar} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="E-mail" htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@smartlar.com.br"
            />
          </Field>
          <Field label="Senha" htmlFor="senha">
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              className={inputCls}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Field>
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <Button type="submit" carregando={entrando} className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
