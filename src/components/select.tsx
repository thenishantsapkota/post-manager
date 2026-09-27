import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

interface Option {
  value: string
  label: ReactNode
  text: string
  disabled: boolean
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/** Read `<option>` children (including mapped arrays and fragments). */
function readOptions(children: ReactNode): Option[] {
  const out: Option[] = []
  const visit = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return
      const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>
      if (el.type === Fragment) return visit(el.props.children)
      if (el.type !== 'option') return
      const label = el.props.children
      out.push({
        value: String(el.props.value ?? textOf(label)),
        label,
        text: textOf(label),
        disabled: Boolean(el.props.disabled),
      })
    })
  }
  visit(children)
  return out
}

export interface SelectProps {
  value: string | number
  /** Same shape as a native change event, so callers can read `e.target.value`. */
  onChange?: (e: { target: { value: string } }) => void
  disabled?: boolean
  className?: string
  children: ReactNode
  'aria-label'?: string
}

/**
 * Custom dropdown with the same API as a native `<select>` (pass `<option>`
 * children). Renders its list in a portal so it isn't clipped inside dialogs.
 * Keyboard: ↑/↓/Home/End to move, Enter/Space to pick, Esc to close, type to jump.
 */
export function Select({ value, onChange, disabled, className, children, ...aria }: SelectProps) {
  const options = useMemo(() => readOptions(children), [children])
  const current = String(value)
  const selectedIndex = options.findIndex((o) => o.value === current)
  const selected = options[selectedIndex]

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  const listId = useId()

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const gap = 6
    const below = window.innerHeight - r.bottom - gap - 8
    const above = r.top - gap - 8
    const wanted = Math.min(320, options.length * 40 + 12)
    const up = below < Math.min(wanted, 200) && above > below
    const maxHeight = Math.max(120, Math.min(wanted, up ? above : below))
    const width = Math.max(r.width, 180)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    setPos({
      position: 'fixed',
      left: Math.max(8, left),
      width,
      maxHeight,
      ...(up ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap }),
    })
  }, [options.length])

  const openList = useCallback(
    (at?: number) => {
      if (disabled) return
      place()
      setActive(at ?? (selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled)))
      setOpen(true)
    },
    [disabled, place, selectedIndex, options],
  )

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const choose = useCallback(
    (i: number) => {
      const o = options[i]
      if (!o || o.disabled) return
      if (o.value !== current) onChange?.({ target: { value: o.value } })
      close()
    },
    [options, current, onChange, close],
  )

  // Keep the list attached to the trigger while open.
  useLayoutEffect(() => {
    if (!open) return
    place()
    listRef.current?.focus({ preventScroll: true })
    const onMove = () => place()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, place])

  // Close on outside press.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return
      close(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])

  // Keep the active option in view.
  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function step(from: number, dir: 1 | -1) {
    for (let i = 1; i <= options.length; i++) {
      const j = (from + dir * i + options.length) % options.length
      if (!options[j].disabled) return j
    }
    return from
  }

  function jumpTo(key: string) {
    const now = Date.now()
    const t = typeahead.current
    t.text = now - t.at > 700 ? key.toLowerCase() : t.text + key.toLowerCase()
    t.at = now
    const start = open ? active : selectedIndex
    const order = options.map((_, i) => (start + 1 + i) % options.length)
    const hit = order.find((i) => !options[i].disabled && options[i].text.toLowerCase().startsWith(t.text))
    return hit ?? -1
  }

  function onTriggerKey(e: ReactKeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openList()
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const hit = jumpTo(e.key)
      if (hit >= 0 && options[hit].value !== current) onChange?.({ target: { value: options[hit].value } })
    }
  }

  function onListKey(e: ReactKeyboardEvent) {
    e.stopPropagation() // keep Esc from also closing a surrounding dialog
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => step(a, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => step(a, -1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(step(-1, 1))
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(step(options.length, -1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const hit = jumpTo(e.key)
      if (hit >= 0) setActive(hit)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={aria['aria-label']}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKey}
        className={cx(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface pl-3 pr-2.5 text-left text-fg transition-colors',
          'hover:border-muted/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
          open && 'border-accent ring-2 ring-accent/20',
          className,
        )}
      >
        <span className={cx('min-w-0 truncate', !selected && 'text-muted')}>{selected ? selected.label : 'Select…'}</span>
        <ChevronDown className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            onKeyDown={onListKey}
            onMouseDown={(e) => e.stopPropagation()}
            style={pos}
            className="z-[70] overflow-y-auto rounded-xl border border-border bg-surface p-1 text-[15px] text-fg shadow-xl outline-none"
          >
            {options.map((o, i) => {
              const isSelected = o.value === current
              return (
                <li
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onClick={() => choose(i)}
                  className={cx(
                    'flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 leading-snug',
                    o.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                    i === active && !o.disabled && 'bg-surface-2',
                    isSelected && 'font-semibold text-accent',
                  )}
                >
                  <span className="min-w-0">{o.label}</span>
                  {isSelected && <Check className="size-4 shrink-0" />}
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </>
  )
}
