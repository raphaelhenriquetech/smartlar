import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui'

type Auth = { session: Session | null; carregando: boolean }

const AuthContext = createContext<Auth>({ session: null, carregando: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSession(novaSessao))
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, carregando }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

// Rota protegida: sem sessão, manda para o login e volta para cá depois.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, carregando } = useAuth()
  const location = useLocation()

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />
  }
  return <>{children}</>
}
