import React, { ReactNode } from 'react'
import { AppProvider } from './AppContext'
import { DocumentProvider } from './DocumentContext'
import { ChatProvider } from './ChatContext'
import { SettingsProvider } from './SettingsContext'

interface AppContextProviderProps {
  children: ReactNode
}

// Combined provider that composes all context providers together
export const AppContextProvider: React.FC<AppContextProviderProps> = ({ children }) => {
  return (
    <SettingsProvider>
      <AppProvider>
        <DocumentProvider>
          <ChatProvider>{children}</ChatProvider>
        </DocumentProvider>
      </AppProvider>
    </SettingsProvider>
  )
}

export default AppContextProvider
