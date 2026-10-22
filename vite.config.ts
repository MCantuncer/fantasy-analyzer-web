/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Strict Content Security Policy for production builds: no third-party scripts, so
// injected code can't read the ESPN cookies kept in browser storage. Dev is left
// alone because Vite's hot reload relies on inline scripts.
function contentSecurityPolicy(apiUrl: string | undefined): Plugin {
  const connect = ["'self'", apiUrl ? new URL(apiUrl).origin : ''].filter(Boolean).join(' ')
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src ${connect}`,
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  }
}

// In development, /api is proxied to the backend on port 8000.
export default defineConfig({
  plugins: [react(), contentSecurityPolicy(process.env.VITE_API_URL)],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
