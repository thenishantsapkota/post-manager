import { Link, Outlet, createFileRoute, redirect, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Bot,
  CalendarClock,
  CloudSun,
  Images,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Palette,
  PenSquare,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { cx } from '#/components/ui'
import { getSessionFn, logoutFn } from '#/functions/auth.functions'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { authenticated } = await getSessionFn()
    if (!authenticated) throw redirect({ to: '/login' })
  },
  component: AppLayout,
})

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/compose', label: 'Compose', icon: PenSquare },
  { to: '/posts', label: 'Posts', icon: CalendarClock },
  { to: '/rashifal', label: 'Rashifal', icon: Sparkles },
  { to: '/weather', label: 'Weather', icon: CloudSun },
  { to: '/templates', label: 'Templates', icon: Palette },
  { to: '/media', label: 'Media', icon: Images },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/automations', label: 'Automations', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

function AppLayout() {
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  async function logout() {
    await logoutFn()
    await router.navigate({ to: '/login' })
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map((item) => {
        const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors',
              active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <Icon className="size-[18px]" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-2.5 px-6 py-5">
      <div className="grid size-9 place-items-center rounded-lg bg-accent font-extrabold text-accent-fg">D</div>
      <div className="leading-tight">
        <p className="font-extrabold">Damak Banda</p>
        <p className="text-xs text-muted">Auto Poster</p>
      </div>
    </div>
  )

  const footer = (
    <div className="border-t border-border p-3">
      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold text-muted hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="size-[18px]" /> Log out
      </button>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-extrabold text-accent-fg">D</div>
          <span className="font-extrabold">Damak Banda</span>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 text-muted hover:bg-surface-2" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-muted" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
