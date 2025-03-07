import './styles/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './theme/theme-provider'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="retrievai-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
