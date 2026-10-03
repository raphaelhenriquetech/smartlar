import { useEffect, useState, type DependencyList } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { mensagemErro } from './errors'

// Desembrulha a resposta do supabase-js: devolve os dados ou lança o erro.
export async function dados<T>(
  consulta: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<T> {
  const { data, error } = await consulta
  if (error) throw error
  return data as T
}

// Carrega dados com estados de loading/erro e um recarregar().
export function useCarregar<T>(carregar: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    carregar()
      .then((d) => ativo && setData(d))
      .catch((e) => ativo && setErro(mensagemErro(e)))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao])

  return { data, carregando, erro, recarregar: () => setVersao((v) => v + 1) }
}
