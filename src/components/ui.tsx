import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import type { PostStatus } from '#/lib/types'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Buttons & inputs
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-[15px]',
        variant === 'primary' && 'bg-accent text-accent-fg hover:opacity-90',
        variant === 'secondary' && 'border border-border bg-surface text-fg hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-fg',
        variant === 'danger' && 'border border-border bg-surface text-bad hover:bg-bad-soft',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

const fieldClass =
  'w-full rounded-lg border border-border bg-surface px-3 text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldClass, 'h-10', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, 'py-2 leading-relaxed', className)} {...rest} />
}

export { Select } from './select'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block space-y-1.5', className)}>
      <span className="block text-sm font-semibold text-fg">{label}</span>
      {children}
      {hint && <span className="block text-[13px] leading-snug text-muted">{hint}</span>}
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2.5', disabled && 'opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        )}
      >
        <span
          className={cx(
            'absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-border bg-surface', className)}>{children}</div>
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>
      <p className="font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: Array<{ value: T; label: ReactNode }>
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
            value === it.value ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

const STATUS_STYLE: Record<PostStatus, string> = {
  draft: 'bg-surface-2 text-muted',
  scheduled: 'bg-info-soft text-info',
  publishing: 'bg-warn-soft text-warn',
  published: 'bg-ok-soft text-ok',
  failed: 'bg-bad-soft text-bad',
}

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize', STATUS_STYLE[status])}>
      {status}
    </span>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    info: 'bg-info-soft text-info',
    accent: 'bg-accent-soft text-accent',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', tones[tone])}>{children}</span>
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-muted', className)} />
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'flex max-h-[94vh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-3xl',
          size === 'xl' && 'sm:max-w-6xl',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface Toast {
  id: number
  tone: 'ok' | 'bad'
  text: string
}

const ToastContext = createContext<{ push: (tone: Toast['tone'], text: string) => void }>({ push: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = next.current++
    setToasts((t) => [...t, { id, tone, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 8000 : 4000)
  }, [])
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg',
              t.tone === 'ok' ? 'border-ok/30 bg-surface text-fg' : 'border-bad/40 bg-surface text-fg',
            )}
          >
            {t.tone === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-bad" />}
            <span className="leading-snug">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Confirm dialog (replaces window.confirm)
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** danger: red confirm button for destructive actions */
  tone?: 'danger' | 'primary'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>
const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirmBtn = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setReq((prev) => {
          prev?.resolve(false)
          return { ...opts, resolve }
        })
      }),
    [],
  )

  const finish = useCallback((result: boolean) => {
    setReq((cur) => {
      cur?.resolve(result)
      return null
    })
  }, [])

  useEffect(() => {
    if (req) requestAnimationFrame(() => confirmBtn.current?.focus())
  }, [req])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!req}
        onClose={() => finish(false)}
        title={req?.title ?? ''}
        footer={
          <>
            <Button onClick={() => finish(false)}>{req?.cancelLabel ?? 'Cancel'}</Button>
            <button
              ref={confirmBtn}
              type="button"
              onClick={() => finish(true)}
              className={cx(
                'inline-flex h-10 items-center justify-center rounded-lg px-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                req?.tone === 'danger' ? 'bg-bad' : 'bg-accent text-accent-fg',
              )}
            >
              {req?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        {req?.message && <div className="text-[15px] leading-relaxed text-muted">{req.message}</div>}
      </Modal>
    </ConfirmContext.Provider>
  )
}

/** `const confirm = useConfirm(); if (await confirm({ title: 'Delete?' })) …` */
export function useConfirm() {
  return useContext(ConfirmContext)
}

export function errorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error:\s*/, '')
}

/** Toast helpers plus a wrapper that runs an async action with a busy flag. */
export function useToast() {
  const { push } = useContext(ToastContext)
  return {
    ok: (text: string) => push('ok', text),
    error: (err: unknown) => push('bad', errorMessage(err)),
  }
}

export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(key)
      try {
        const result = await fn()
        if (success) toast.ok(success)
        return result
      } catch (err) {
        toast.error(err)
        return undefined
      } finally {
        setBusy(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  return { busy, run }
}

export function mediaUrl(id: string) {
  return `/api/media/${id}`
}
