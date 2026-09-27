import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button, Field, Input, errorMessage } from '#/components/ui'
import { getSessionFn, loginFn } from '#/functions/auth.functions'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { authenticated } = await getSessionFn()
    if (authenticated) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await loginFn({ data: { password } })
      await router.navigate({ to: '/' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-accent text-lg font-extrabold text-accent-fg">D</div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">Damak Banda</h1>
            <p className="text-sm text-muted">Auto Poster</p>
          </div>
        </div>
        <Field label="Admin password">
          <Input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
        <Button type="submit" variant="primary" className="mt-5 w-full" loading={busy} icon={<Lock className="size-4" />} disabled={!password}>
          Sign in
        </Button>
      </form>
    </div>
  )
}
