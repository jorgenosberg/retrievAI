import './styles/globals.css'

import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from '@/theme/theme-provider'
import { AppContextProvider } from '@/contexts'

// Removed StrictMode to prevent double rendering in production
// This significantly improves performance by preventing double renders
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ThemeProvider defaultTheme="dark" storageKey="retrievai-theme">
    <AppContextProvider>
      <App />
    </AppContextProvider>
  </ThemeProvider>
)
