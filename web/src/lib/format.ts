import type { Categoria, FormaPagamento, Status } from './types'

const FUSO = 'America/Sao_Paulo'

// Dinheiro ----------------------------------------------------------------------

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarBRL(valor: number | null | undefined) {
  return brl.format(valor ?? 0)
}

// Conta em centavos (inteiros) para não acumular erro de ponto flutuante.
export function centavos(valor: number) {
  return Math.round(valor * 100)
}

// Datas (sempre no horário de Brasília) -----------------------------------------

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const fmtData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
})
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit',
})
// en-CA formata como AAAA-MM-DD: serve de chave de dia no fuso de SP.
const fmtChaveDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
})

export const formatarDataHora = (iso: string | null | undefined) => (iso ? fmtDataHora.format(new Date(iso)) : '—')
export const formatarData = (iso: string | null | undefined) => (iso ? fmtData.format(new Date(iso)) : '—')
export const formatarHora = (iso: string | null | undefined) => (iso ? fmtHora.format(new Date(iso)) : '—')
export const formatarDiaSemana = (iso: string) => fmtDiaSemana.format(new Date(iso))

export const chaveDia = (data: string | Date) => fmtChaveDia.format(new Date(data))

export function chaveDiaRelativa(dias: number) {
  return chaveDia(new Date(Date.now() + dias * 86_400_000))
}

// Dias inteiros desde a data (para "há 3 dias").
export function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// <input type="datetime-local"> devolve "AAAA-MM-DDTHH:mm" sem fuso. O horário
// digitado é sempre o de Brasília (UTC-3, sem horário de verão desde 2019),
// independente do fuso do computador de quem usa.
export function datetimeLocalParaISO(valor: string) {
  return new Date(`${valor}:00-03:00`).toISOString()
}

export function sugestaoAgendamento() {
  return `${chaveDiaRelativa(1)}T09:00`
}

// Telefone ----------------------------------------------------------------------

export const somenteDigitos = (valor: string) => valor.replace(/\D/g, '')

function mascaraNacional(d: string) {
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}

// Aceita DDD + número (10/11 dígitos) ou com DDI 55 (12/13 dígitos).
export function formatarTelefone(valor: string | null | undefined) {
  const d = somenteDigitos(valor ?? '').slice(0, 13)
  if (d.length > 11) return `+${d.slice(0, 2)} ${mascaraNacional(d.slice(2))}`
  return mascaraNacional(d)
}

export function linkWhatsApp(telefone: string) {
  const d = somenteDigitos(telefone)
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`
}

export function linkMapa(endereco: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`
}

// Rótulos -----------------------------------------------------------------------

export const STATUS_LABEL: Record<Status, string> = {
  orcamento: 'Orçamento',
  aprovado: 'Aprovado',
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const STATUS_COR: Record<Status, string> = {
  orcamento: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  aprovado: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  agendado: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  em_andamento: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  concluido: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  cancelado: 'bg-slate-100 text-slate-500 ring-slate-500/20',
}

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  seguranca: 'Segurança',
  iluminacao: 'Iluminação',
  automacao: 'Automação',
}

export const PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
}

// Busca sem diferenciar maiúsculas nem acentos ("joao" encontra "João").
export function normalizarBusca(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// CEP ---------------------------------------------------------------------------

export function formatarCep(valor: string) {
  const d = somenteDigitos(valor).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}
