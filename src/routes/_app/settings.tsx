import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckCircle2, ExternalLink, ImagePlus, KeyRound, PlugZap, Unplug } from 'lucide-react'
import { MediaPicker } from '#/components/media-picker'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Textarea, mediaUrl, useAction } from '#/components/ui'
import {
  connectPageFn,
  disconnectPageFn,
  exchangeTokenFn,
  getSettingsFn,
  saveSettingsFn,
  testConnectionFn,
} from '#/functions/settings.functions'
import { captionCredit } from '#/lib/credit'

export const Route = createFileRoute('/_app/settings')({
  loader: () => getSettingsFn(),
  component: SettingsPage,
})

function SettingsPage() {
  const s = Route.useLoaderData()
  return (
    <>
      <PageHeader title="Settings" subtitle="Facebook connection, branding and caption defaults." />
      <div className="grid gap-6 xl:grid-cols-2">
        <FacebookCard s={s} />
        <BrandingCard s={s} />
        <CaptionCard s={s} />
        <SchedulerCard s={s} />
      </div>
    </>
  )
}

type S = Awaited<ReturnType<typeof getSettingsFn>>

function FacebookCard({ s }: { s: S }) {
  const router = useRouter()
  const { busy, run } = useAction()
  const [pageId, setPageId] = useState(s.fbPageId)
  const [token, setToken] = useState('')
  const [helper, setHelper] = useState(false)
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [userToken, setUserToken] = useState('')
  const [pages, setPages] = useState<Awaited<ReturnType<typeof exchangeTokenFn>> | null>(null)
  const [info, setInfo] = useState<Awaited<ReturnType<typeof testConnectionFn>> | null>(null)

  async function connect(id: string, tok: string) {
    const res = await run('connect', () => connectPageFn({ data: { pageId: id, token: tok } }))
    if (res) {
      setToken('')
      setPages(null)
      setHelper(false)
      await router.invalidate()
    }
  }

  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="Facebook page"
        subtitle={`Graph API ${s.graphVersion}`}
        action={s.hasToken ? <Badge tone="ok"><CheckCircle2 className="size-3" /> Connected</Badge> : <Badge tone="warn">Not connected</Badge>}
      />
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          {s.hasToken && (
            <div className="rounded-lg border border-border bg-surface-2/50 p-4">
              <div className="flex items-center gap-3">
                {info?.picture && <img src={info.picture} alt="" className="size-10 rounded-full" />}
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{info?.name ?? s.fbPageName}</p>
                  <p className="text-sm text-muted">
                    Page ID {s.fbPageId} · token {s.tokenPreview}
                    {info?.followers != null && ` · ${info.followers.toLocaleString()} followers`}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={<PlugZap className="size-4" />} loading={busy === 'test'} onClick={async () => setInfo((await run('test', () => testConnectionFn(), 'Connection works')) ?? null)}>
                  Test connection
                </Button>
                {info?.link && (
                  <a href={info.link} target="_blank" rel="noreferrer"><Button size="sm" icon={<ExternalLink className="size-4" />}>Open page</Button></a>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Unplug className="size-4" />}
                  onClick={async () => {
                    if (!confirm('Disconnect the page? Scheduled posts will fail until you reconnect.')) return
                    await run('disc', () => disconnectPageFn(), 'Disconnected')
                    await router.invalidate()
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          )}

          <p className="font-semibold">{s.hasToken ? 'Replace the token' : 'Connect with a Page access token'}</p>
          <Field label="Page ID" hint="Found under your Page → About → Page transparency, or in the Graph API Explorer.">
            <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="1234567890" />
          </Field>
          <Field label="Page access token" hint="Needs pages_manage_posts and pages_read_engagement. Stored on this server only and never sent back to the browser.">
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG…" autoComplete="off" />
          </Field>
          <Button variant="primary" loading={busy === 'connect'} disabled={!pageId || token.length < 20} onClick={() => connect(pageId.trim(), token.trim())}>
            Verify & connect
          </Button>
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-bold">Get a token that doesn't expire</p>
              <p className="text-sm text-muted">Tokens from the Graph API Explorer expire in about an hour. Exchange one here for a permanent page token.</p>
            </div>
          </div>
          {!helper ? (
            <Button size="sm" className="mt-3" onClick={() => setHelper(true)}>Show me how</Button>
          ) : (
            <div className="mt-4 space-y-3">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                <li>Create an app at <a className="font-semibold text-accent" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> (type “Business”). Note its App ID and App Secret.</li>
                <li>Open the <a className="font-semibold text-accent" href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">Graph API Explorer</a>, pick your app, add the permissions <code className="rounded bg-surface-2 px-1">pages_manage_posts</code>, <code className="rounded bg-surface-2 px-1">pages_read_engagement</code> and <code className="rounded bg-surface-2 px-1">pages_show_list</code>, then click “Generate Access Token” and tick your Page when Facebook asks which Pages to allow. Don't add <code className="rounded bg-surface-2 px-1">manage_pages</code> or <code className="rounded bg-surface-2 px-1">publish_pages</code>: Facebook retired them and shows an “Invalid Scopes” error.</li>
                <li>Paste the three values below. The App Secret is used once for the exchange and is not saved.</li>
              </ol>
              <Input placeholder="App ID" value={appId} onChange={(e) => setAppId(e.target.value)} />
              <Input type="password" placeholder="App Secret" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} autoComplete="off" />
              <Textarea rows={2} placeholder="User access token from the Explorer" value={userToken} onChange={(e) => setUserToken(e.target.value)} />
              <Button
                variant="primary"
                loading={busy === 'exchange'}
                disabled={!appId || !appSecret || !userToken}
                onClick={async () => setPages((await run('exchange', () => exchangeTokenFn({ data: { appId, appSecret, userToken } }))) ?? null)}
              >
                Find my pages
              </Button>
              {pages && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  <li className="p-3 text-[13px] text-muted">Logged in to Facebook as <strong className="text-fg">{pages.userName}</strong></li>
                  {pages.missingPermissions.length > 0 && (
                    <li className="p-3 text-sm text-bad">
                      Missing permission{pages.missingPermissions.length > 1 ? 's' : ''}: {pages.missingPermissions.join(', ')}. Add {pages.missingPermissions.length > 1 ? 'them' : 'it'} in the Graph API Explorer and generate a new token.
                    </li>
                  )}
                  {pages.pages.length === 0 && (
                    <li className="space-y-1 p-3 text-sm text-muted">
                      <p className="font-semibold text-fg">No pages found.</p>
                      {pages.selectedPageIds.length === 0 ? (
                        <p>No Page was allowed for this token. Generate the token again and, when Facebook asks which Pages this app can use, tick your Page.</p>
                      ) : (
                        <p>You allowed Page {pages.selectedPageIds.join(', ')}, but this account can't get a token for it. Make sure this Facebook profile has full control of the Page (Page settings → Page access).</p>
                      )}
                    </li>
                  )}
                  {pages.pages.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-[13px] text-muted">{p.id}{!p.canPost && ' · you may not have posting rights'}</p>
                      </div>
                      <Button size="sm" variant="primary" loading={busy === 'connect'} onClick={() => connect(p.id, p.token)}>Use this page</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function BrandingCard({ s }: { s: S }) {
  const router = useRouter()
  const { busy, run } = useAction()
  const [brandName, setBrandName] = useState(s.brandName)
  const [brandHandle, setBrandHandle] = useState(s.brandHandle)
  const [logo, setLogo] = useState(s.logoMediaId)
  const [picker, setPicker] = useState(false)

  return (
    <Card>
      <CardHeader title="Branding" subtitle="Shown on built-in designs, templates ({brand}, {handle}, logo layers) and watermarks." />
      <div className="space-y-4 p-5">
        <Field label="Page name"><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} /></Field>
        <Field label="Handle / website"><Input value={brandHandle} onChange={(e) => setBrandHandle(e.target.value)} /></Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Logo</p>
          <div className="flex items-center gap-3">
            {logo ? <img src={mediaUrl(logo)} alt="Logo" className="checker size-16 rounded-full object-cover" /> : <div className="grid size-16 place-items-center rounded-full bg-surface-2 text-muted"><ImagePlus className="size-5" /></div>}
            <Button size="sm" onClick={() => setPicker(true)}>{logo ? 'Change' : 'Choose logo'}</Button>
            {logo && <Button size="sm" variant="ghost" onClick={() => setLogo('')}>Remove</Button>}
          </div>
          <p className="mt-1.5 text-[13px] text-muted">A square PNG with transparency works best.</p>
        </div>
        <Button
          variant="primary"
          loading={busy === 'save'}
          onClick={async () => {
            await run('save', () => saveSettingsFn({ data: { brandName, brandHandle, logoMediaId: logo } }), 'Branding saved')
            await router.invalidate()
          }}
        >
          Save branding
        </Button>
      </div>
      <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(m) => setLogo(m[0].id)} title="Choose logo" />
    </Card>
  )
}

function CaptionCard({ s }: { s: S }) {
  const router = useRouter()
  const { busy, run } = useAction()
  const [caption, setCaption] = useState(s.rashifalCaption)
  const [hashtags, setHashtags] = useState(s.hashtags)

  return (
    <Card>
      <CardHeader title="Rashifal caption" />
      <div className="space-y-4 p-5">
        <Field
          label="Caption template"
          hint="Placeholders: {heading} {subtitle} {title} {author} {date_bs} {date_ad} {weekday} {rashifal} {hashtags} {brand} {credit}"
        >
          <Textarea rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} className="font-mono text-sm" />
        </Field>
        <Field label="Hashtags"><Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} /></Field>
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="mb-1 text-[13px] font-semibold text-muted">Always added at the end (required credit):</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{captionCredit('<astrologer name>')}</pre>
        </div>
        <Button
          variant="primary"
          loading={busy === 'save'}
          onClick={async () => {
            await run('save', () => saveSettingsFn({ data: { rashifalCaption: caption, hashtags } }), 'Caption saved')
            await router.invalidate()
          }}
        >
          Save caption
        </Button>
      </div>
    </Card>
  )
}

function SchedulerCard({ s }: { s: S }) {
  return (
    <Card>
      <CardHeader title="Scheduler" />
      <div className="space-y-3 p-5 text-sm leading-relaxed">
        <p className="flex items-center gap-2">
          In-process scheduler: {s.schedulerEnabled ? <Badge tone="ok">running every 30s</Badge> : <Badge tone="warn">disabled</Badge>}
        </p>
        <p className="text-muted">
          While this server is running, due posts and automations are handled automatically. If you host somewhere that sleeps
          when idle, also call the cron endpoint every few minutes (e.g. with cron-job.org):
        </p>
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[13px]">curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron</pre>
        <p className="text-muted">
          Cron endpoint: {s.cronConfigured ? <Badge tone="ok">CRON_SECRET set</Badge> : <Badge>off (set CRON_SECRET to enable)</Badge>}
        </p>
      </div>
    </Card>
  )
}
