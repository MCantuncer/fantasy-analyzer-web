// Front Office type: Host Grotesk for words, Mona Sans (normal width, 10% smaller) for numbers.
import '@fontsource-variable/host-grotesk/wght.css'
import './styles/num-font.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CrashScreen } from './components/CrashScreen'
import './index.css'
import './styles/shell.css'
import './styles/game-night.css'
import './styles/phone'
import { watchErrors } from './lib/errorReport'
import { applyTheme, loadTheme } from './lib/theme'

applyTheme(loadTheme())
watchErrors()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashScreen>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </CrashScreen>
  </StrictMode>,
)
