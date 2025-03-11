import { AppProvider, useAppContext } from './AppContext'
import { DocumentProvider, useDocumentContext } from './DocumentContext'
import { ChatProvider, useChatContext } from './ChatContext'
import { SettingsProvider, useSettingsContext } from './SettingsContext'
import { AppContextProvider } from './AppContextProvider'

// Export individual contexts for direct import
export {
  AppProvider,
  useAppContext,
  DocumentProvider,
  useDocumentContext,
  ChatProvider,
  useChatContext,
  SettingsProvider,
  useSettingsContext
}

// Export combined provider
export { AppContextProvider }
