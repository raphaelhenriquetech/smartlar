import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider, RequireAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { EmptyState } from './components/ui'
import Login from './pages/Login'

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
            <Route path="pedidos" element={<EmConstrucao />} />
            <Route path="pedidos/novo" element={<EmConstrucao />} />
            <Route path="pedidos/:id" element={<EmConstrucao />} />
            <Route path="agenda" element={<EmConstrucao />} />
            <Route path="clientes" element={<EmConstrucao />} />
            <Route path="produtos" element={<EmConstrucao />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </BrowserRouter>
  )
}
