import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider, RequireAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { EmptyState } from './components/ui'
import Login from './pages/Login'
import Produtos from './pages/Produtos'
import Clientes from './pages/Clientes'
import NovoPedido from './pages/NovoPedido'
import Pedidos from './pages/Pedidos'
import PedidoDetalhe from './pages/PedidoDetalhe'
import Agenda from './pages/Agenda'

function EmConstrucao() {
  return <EmptyState titulo="Tela em construção" />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<EmConstrucao />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="pedidos/novo" element={<NovoPedido />} />
            <Route path="pedidos/:id" element={<PedidoDetalhe />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </BrowserRouter>
  )
}
