import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ToastProvider } from '#/components/ui'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Damak Banda · Auto Poster' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700;800&display=swap' },
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'icon',
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23be123c'/><text x='16' y='23' font-size='18' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'>D</text></svg>",
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center p-8 text-center">
      <div>
        <p className="text-5xl font-extrabold">404</p>
        <p className="mt-2 text-muted">That page doesn't exist.</p>
        <a href="/" className="mt-4 inline-block font-semibold text-accent">Go to dashboard</a>
      </div>
    </div>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <Scripts />
      </body>
    </html>
  )
}
