import '@fontsource-variable/host-grotesk/wght.css'
import './styles/num-font.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/shell.css'
import './styles/phone'
import { applyTheme } from './lib/theme'
import { TradeOfTheDay } from './components/TradeOfTheDay'

const theme = new URLSearchParams(location.search).get('theme') ?? 'dark'
applyTheme(theme as never)
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <main className="container" style={{ padding: 16 }}>
      <TradeOfTheDay leagueId={1} season={2027} leagueName="Test" myTeamId={3} teamIds={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} creds={null} />
    </main>
  </QueryClientProvider>,
)
