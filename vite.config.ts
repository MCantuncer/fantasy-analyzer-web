/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Strict Content Security Policy for production builds: the only third-party script is
// Google's sign-in button, so injected code can't read the ESPN cookies or the session
// kept in browser storage. Dev is left alone because Vite's hot reload relies on inline scripts.
function contentSecurityPolicy(apiUrl: string | undefined): Plugin {
  const google = 'https://accounts.google.com/gsi/'
  const connect = ["'self'", apiUrl ? new URL(apiUrl).origin : '', google].filter(Boolean).join(' ')
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${google}client`,
    `style-src 'self' 'unsafe-inline' ${google}style`,
    "img-src 'self' data:",
    `connect-src ${connect}`,
    `frame-src ${google}`,
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
