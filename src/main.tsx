// Front Office type: Host Grotesk for words, Mona Sans (width axis) for numbers, Martian Mono for codes.
import '@fontsource-variable/host-grotesk/wght.css'
import '@fontsource-variable/mona-sans/wdth.css'
import '@fontsource-variable/martian-mono/wdth.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/shell.css'
import './styles/phone'
import { applyTheme, loadTheme } from './lib/theme'

applyTheme(loadTheme())

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
