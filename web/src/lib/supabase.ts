import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Sem as variáveis o app mostra uma tela de configuração em vez de quebrar.
export const supabaseConfigurado = Boolean(url && chave)

export const supabase = createClient<Database>(
  url ?? 'http://localhost',
  chave ?? 'chave-ausente',
)
