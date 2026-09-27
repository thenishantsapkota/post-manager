import { config } from './config'

// Thin client for the Facebook Graph API endpoints this app needs.
// Docs: https://developers.facebook.com/docs/pages-api/posts

export class FacebookError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly traceId?: string,
  ) {
    super(message)
    this.name = 'FacebookError'
  }

  /** Error code 190 means the access token is invalid or expired. */
  get isAuthError() {
    return this.code === 190 || this.code === 102
  }
}

function url(path: string, query?: Record<string, string>) {
  const u = new URL(`https://graph.facebook.com/${config.graphVersion}/${path.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, v)
  return u
}

async function call<T>(input: URL, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(input, { ...init, signal: AbortSignal.timeout(120_000) })
  } catch (err) {
    throw new FacebookError(`Could not reach Facebook: ${(err as Error).message}`)
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message: string; code?: number; error_subcode?: number; fbtrace_id?: string; error_user_msg?: string }
  } & T
  if (!res.ok || body.error) {
    const e = body.error
    throw new FacebookError(
      e?.error_user_msg || e?.message || `Facebook returned HTTP ${res.status}`,
      e?.code,
      e?.error_subcode,
      e?.fbtrace_id,
    )
  }
  return body
}

export interface PageInfo {
  id: string
  name: string
  link?: string
  fan_count?: number
  followers_count?: number
  picture?: { data?: { url?: string } }
}

export function getPage(pageId: string, token: string) {
  return call<PageInfo>(
    url(pageId, {
      fields: 'id,name,link,fan_count,followers_count,picture{url}',
      access_token: token,
    }),
  )
}

export interface ImageInput {
  data: Buffer
  mime: string
  filename: string
}

function imageBlob(img: ImageInput) {
  return new Blob([new Uint8Array(img.data)], { type: img.mime })
}

async function uploadPhoto(
  pageId: string,
  token: string,
  img: ImageInput,
  opts: { published: boolean; message?: string },
) {
  const form = new FormData()
  form.set('access_token', token)
  form.set('published', String(opts.published))
  if (opts.message) form.set('message', opts.message)
  form.set('source', imageBlob(img), img.filename)
  return call<{ id: string; post_id?: string }>(url(`${pageId}/photos`), {
    method: 'POST',
    body: form,
  })
}

async function postForm<T>(path: string, params: Record<string, string>) {
  return call<T>(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
}

/**
 * Publish a post to the page immediately.
 * - no images: text status update
 * - one image: photo post with caption
 * - several images: images are uploaded unpublished, then attached to one feed post
 */
export async function publishToPage(opts: {
  pageId: string
  token: string
  message: string
  images: ImageInput[]
}): Promise<{ postId: string; permalink?: string }> {
  const { pageId, token, message, images } = opts
  let postId: string

  if (images.length === 0) {
    if (!message.trim()) throw new Error('A post needs a caption or at least one image.')
    const res = await postForm<{ id: string }>(`${pageId}/feed`, { message, access_token: token })
    postId = res.id
  } else if (images.length === 1) {
    const res = await uploadPhoto(pageId, token, images[0], { published: true, message })
    postId = res.post_id ?? res.id
  } else {
    const photoIds: string[] = []
    for (const img of images) {
      const res = await uploadPhoto(pageId, token, img, { published: false })
      photoIds.push(res.id)
    }
    const params: Record<string, string> = { message, access_token: token }
    photoIds.forEach((id, i) => {
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
    })
    const res = await postForm<{ id: string }>(`${pageId}/feed`, params)
    postId = res.id
  }

  let permalink: string | undefined
  try {
    const info = await call<{ permalink_url?: string }>(
      url(postId, { fields: 'permalink_url', access_token: token }),
    )
    permalink = info.permalink_url
  } catch {
    // Permalink is a nice-to-have; the post itself succeeded.
  }
  return { postId, permalink }
}

export interface ManagedPage {
  id: string
  name: string
  access_token: string
  tasks?: string[]
}

export interface TokenExchangeResult {
  pages: ManagedPage[]
  userName: string
  granted: string[]
  /** Pages the user ticked in the permission dialog (from granular scopes). */
  selectedPageIds: string[]
}

/**
 * Turn a short-lived user token (from Graph API Explorer) into page tokens.
 * Page tokens derived from a long-lived user token do not expire.
 *
 * `/me/accounts` omits Pages the user reaches through a Business portfolio, so
 * we also read the Pages ticked in the permission dialog (granular scopes on
 * the token) and fetch each of those directly.
 */
export async function exchangeForPageTokens(opts: {
  appId: string
  appSecret: string
  userToken: string
}): Promise<TokenExchangeResult> {
  const ll = await call<{ access_token: string }>(
    url('oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: opts.appId,
      client_secret: opts.appSecret,
      fb_exchange_token: opts.userToken,
    }),
  )
  return findPages(ll.access_token, `${opts.appId}|${opts.appSecret}`)
}

/** List the Pages (with Page tokens) a user token can act for. */
export async function findPages(token: string, appToken?: string): Promise<TokenExchangeResult> {
  type Debug = { data: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } }
  const debugWith = (access: string) => call<Debug>(url('debug_token', { input_token: token, access_token: access }))
  const [me, perms, accounts, debug] = await Promise.all([
    call<{ name: string }>(url('me', { fields: 'name', access_token: token })),
    call<{ data: Array<{ permission: string; status: string }> }>(url('me/permissions', { access_token: token })),
    call<{ data: ManagedPage[] }>(url('me/accounts', { fields: 'id,name,access_token,tasks', access_token: token, limit: '100' })),
    (appToken ? debugWith(appToken) : Promise.reject(new Error('no app token')))
      .catch(() => debugWith(token))
      .catch((): Debug => ({ data: {} })),
  ])

  const selectedPageIds = [
    ...new Set(
      (debug.data.granular_scopes ?? [])
        .filter((g) => g.scope === 'pages_show_list' || g.scope === 'pages_manage_posts')
        .flatMap((g) => g.target_ids ?? []),
    ),
  ]

  const pages = [...accounts.data]
  for (const id of selectedPageIds) {
    if (pages.some((p) => p.id === id)) continue
    try {
      const page = await call<{ id: string; name: string; access_token?: string }>(
        url(id, { fields: 'id,name,access_token', access_token: token }),
      )
      if (page.access_token) pages.push({ id: page.id, name: page.name, access_token: page.access_token })
    } catch {
      // No access to this Page; it's reported as missing below.
    }
  }

  return {
    pages,
    userName: me.name,
    granted: perms.data.filter((p) => p.status === 'granted').map((p) => p.permission),
    selectedPageIds,
  }
}
