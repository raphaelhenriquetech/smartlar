import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import {
  CalendarDays, ClipboardList, House, LayoutDashboard, LogOut, Menu, Package, PlusCircle, Users, X,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { cx } from './ui'

type ItemMenu = { to: string; label: string; icone: LucideIcon; ativo: (caminho: string) => boolean }

const MENU: ItemMenu[] = [
  { to: '/', label: 'Dashboard', icone: LayoutDashboard, ativo: (c) => c === '/' },
  {
    to: '/pedidos', label: 'Pedidos', icone: ClipboardList,
    ativo: (c) => c.startsWith('/pedidos') && c !== '/pedidos/novo',
  },
  { to: '/pedidos/novo', label: 'Novo pedido', icone: PlusCircle, ativo: (c) => c === '/pedidos/novo' },
  { to: '/agenda', label: 'Agenda', icone: CalendarDays, ativo: (c) => c.startsWith('/agenda') },
  { to: '/clientes', label: 'Clientes', icone: Users, ativo: (c) => c.startsWith('/clientes') },
  { to: '/produtos', label: 'Produtos', icone: Package, ativo: (c) => c.startsWith('/produtos') },
]

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-teal-600 text-white">
        <House className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="font-semibold text-slate-900">SmartLar</p>
        <p className="text-xs text-slate-500">Gestão de instalações</p>
      </div>
    </div>
  )
}

function Navegacao() {
  const { pathname } = useLocation()
  const { session } = useAuth()

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Marca />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {MENU.map(({ to, label, icone: Icone, ativo }) => (
          <Link
            key={to}
            to={to}
            className={cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              ativo(pathname) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icone className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <p className="truncate px-3 pb-2 text-xs text-slate-500" title={session?.user.email}>
          {session?.user.email}
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="size-[18px]" />
          Sair
        </button>
      </div>
    </div>
  )
}

export function Layout() {
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setMenuAberto(false), [pathname])

  return (
    <div className="min-h-screen">
      {/* Desktop: barra lateral fixa */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Navegacao />
      </aside>

      {/* Celular: barra no topo + gaveta */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Marca />
        <button
          onClick={() => setMenuAberto(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menu"
        >
          <Menu className="size-6" />
        </button>
      </header>
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button
              onClick={() => setMenuAberto(false)}
              className="absolute right-3 top-5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            <Navegacao />
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
