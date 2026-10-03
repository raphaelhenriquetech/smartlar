import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Inbox, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import type { Status } from '../lib/types'
import { STATUS_COR, STATUS_LABEL } from '../lib/format'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// Botão -------------------------------------------------------------------------

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTES: Record<Variante, string> = {
  primary: 'bg-teal-600 text-white shadow-sm hover:bg-teal-700',
  secondary: 'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamanho?: 'sm' | 'md' | 'lg'
  carregando?: boolean
  icone?: ReactNode
}

export function Button({
  variante = 'primary', tamanho = 'md', carregando, icone, className, children, disabled, ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600',
        'disabled:cursor-not-allowed disabled:opacity-60',
        tamanho === 'sm' && 'px-2.5 py-1.5 text-sm',
        tamanho === 'md' && 'px-3.5 py-2 text-sm',
        tamanho === 'lg' && 'px-4 py-3 text-base',
        VARIANTES[variante],
        className,
      )}
    >
      {carregando ? <LoaderCircle className="size-4 animate-spin" /> : icone}
      {children}
    </button>
  )
}

// Layout de página --------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
}

export function PageHeader({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

export function SectionTitle({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <h2 className="text-sm font-semibold text-slate-900">{children}</h2>
      {acao}
    </div>
  )
}

// Formulário --------------------------------------------------------------------

export const inputCls =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 ' +
  'placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 focus:outline-none ' +
  'disabled:bg-slate-50 disabled:text-slate-500'

export const inputErroCls = 'ring-red-400 focus:ring-red-500'

export function Field({
  label, htmlFor, obrigatorio, erro, dica, children, className,
}: {
  label: string
  htmlFor?: string
  obrigatorio?: boolean
  erro?: string | null
  dica?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {obrigatorio && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {erro ? (
        <p className="mt-1 text-xs text-red-600">{erro}</p>
      ) : (
        dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>
      )}
    </div>
  )
}

// Badges ------------------------------------------------------------------------

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return <Badge className={STATUS_COR[status]}>{STATUS_LABEL[status]}</Badge>
}

// Modal -------------------------------------------------------------------------

export function Modal({
  aberto, titulo, onFechar, children, rodape, largo,
}: {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: ReactNode
  rodape?: ReactNode
  largo?: boolean
}) {
  const fecharRef = useRef(onFechar)
  fecharRef.current = onFechar

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && fecharRef.current()
    const overflowAnterior = document.body.style.overflow
    document.addEventListener('keydown', aoTeclar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onFechar} />
      <div
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          largo ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <button
            onClick={onFechar}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}

// Estados -----------------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx('size-5 animate-spin text-teal-600', className)} />
}

export function LoadingState({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner /> {texto}
    </div>
  )
}

export function EmptyState({ titulo, descricao, acao }: { titulo: string; descricao?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        <Inbox className="size-6" />
      </div>
      <p className="text-sm font-medium text-slate-700">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-slate-500">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function ErrorState({ mensagem, onTentarNovamente }: { mensagem: string; onTentarNovamente?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-500">
        <TriangleAlert className="size-6" />
      </div>
      <p className="text-sm font-medium text-slate-700">Não foi possível carregar os dados</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{mensagem}</p>
      {onTentarNovamente && (
        <Button variante="secondary" className="mt-4" onClick={onTentarNovamente}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

// Confirmação ---------------------------------------------------------------------

export function ConfirmModal({
  titulo, mensagem, rotuloConfirmar, perigoso, carregando, onConfirmar, onFechar,
}: {
  titulo: string
  mensagem: ReactNode
  rotuloConfirmar: string
  perigoso?: boolean
  carregando?: boolean
  onConfirmar: () => void
  onFechar: () => void
}) {
  return (
    <Modal
      aberto
      titulo={titulo}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar}>Voltar</Button>
          <Button variante={perigoso ? 'danger' : 'primary'} carregando={carregando} onClick={onConfirmar}>
            {rotuloConfirmar}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{mensagem}</div>
    </Modal>
  )
}
