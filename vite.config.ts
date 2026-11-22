/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Strict Content Security Policy for production builds: the only third-party scripts are
// Google's sign-in button and Paddle's checkout, so injected code can't read the ESPN cookies or the session
// kept in browser storage. Dev is left alone because Vite's hot reload relies on inline scripts.
function contentSecurityPolicy(apiUrl: string | undefined): Plugin {
  const google = 'https://accounts.google.com/gsi/'
  // Paddle's checkout (COURT Pro): its script, its overlay frame and the calls the overlay makes.
  const paddle = 'https://cdn.paddle.com'
  const paddleFrames = 'https://buy.paddle.com https://sandbox-buy.paddle.com'
  const connect = ["'self'", apiUrl ? new URL(apiUrl).origin : '', google, 'https://*.paddle.com']
    .filter(Boolean)
    .join(' ')
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${google}client ${paddle}`,
    `style-src 'self' 'unsafe-inline' ${google}style ${paddle}`,
    `img-src 'self' data: https://a.espncdn.com ${paddle}`,
    `connect-src ${connect}`,
    `frame-src ${google} ${paddleFrames}`,
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
  define: {
    __BUILD__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)),
  },
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
