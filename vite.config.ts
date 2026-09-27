import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Native / Node-only packages must never be pre-bundled or bundled.
const NATIVE = ['@napi-rs/canvas', '@libsql/client', 'libsql']

export default defineConfig({
  resolve: { tsconfigPaths: true },
  ssr: {
    external: NATIVE,
    optimizeDeps: { exclude: NATIVE },
  },
  optimizeDeps: { exclude: NATIVE },
  plugins: [
    nitro({
      handlers: [{ route: '/api/media/:id', method: 'GET', handler: './src/nitro/media.ts' }],
      rollupConfig: { external: [/^@napi-rs\/canvas/, /^@libsql\//, /^libsql/] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
