import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { supabaseConfigurado } from './lib/supabase'

function ConfiguracaoAusente() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Configuração do Supabase ausente</p>
        <p className="mt-2">
          Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (veja{' '}
          <code>web/.env.example</code>) e reinicie o app.
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{supabaseConfigurado ? <App /> : <ConfiguracaoAusente />}</StrictMode>,
)
