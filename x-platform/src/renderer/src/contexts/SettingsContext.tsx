import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react'
import { SettingsContextType } from './types'

// Create the context with a default undefined value
const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

// Provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [settings, setSettings] = useState<SettingsContextType['settings']>({
    defaultModel: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000
    },
    embeddingModel: {
      provider: 'openai',
      model: 'text-embedding-3-small'
    },
    ragConfig: {
      chunkSize: 1000,
      chunkOverlap: 200,
      similarityThreshold: 0.7,
      maxSources: 5
    }
  })

  // Actions
  const loadSettings = useCallback(async () => {
    try {
      const loadedSettings = await window.electronAPI.settings.getAll()
      setSettings(loadedSettings)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }, [])

  const updateSettings = useCallback(
    async (newSettings: Partial<SettingsContextType['settings']>) => {
      try {
        await window.electronAPI.settings.update(newSettings)

        // Update only the changed fields, not the entire settings object
        setSettings((prevSettings) => ({
          ...prevSettings,
          ...newSettings
        }))
      } catch (error) {
        console.error('Failed to update settings:', error)
      }
    },
    []
  )

  const setApiKey = useCallback(async (provider: string, key: string) => {
    try {
      await window.electronAPI.settings.setApiKey(provider, key)
      // No need to update local state as we don't store API keys in memory
    } catch (error) {
      console.error(`Failed to set API key for ${provider}:`, error)
    }
  }, [])

  // Combine state and actions
  const contextValue: SettingsContextType = {
    settings,
    loadSettings,
    updateSettings,
    setApiKey
  }

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>
}

// Custom hook to use the context
export const useSettingsContext = () => {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettingsContext must be used within a SettingsProvider')
  }
  return context
}
