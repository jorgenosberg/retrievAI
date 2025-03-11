import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react'
import { AppContextType } from './types'

// Create the context with a default undefined value
const AppContext = createContext<AppContextType | undefined>(undefined)

// Provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [appStatus, setAppStatus] = useState<'initializing' | 'ready' | 'error'>('initializing')
  const [initializationError, setInitializationError] = useState<string | null>(null)
  const [servicesReady, setServicesReady] = useState(false)

  // Actions
  const initializeApp = useCallback(() => {
    console.log('Starting app initialization...')

    // Prevent multiple initialization attempts
    if (appStatus !== 'initializing') {
      console.log('App already initialized, skipping')
      return
    }

    let appInitialized = false

    // Listen for the app:ready event from the main process (UI is ready)
    window.electronAPI.app.onReady(async () => {
      try {
        console.log('UI is ready, loading essential data...')

        // Load settings in the background using a non-blocking approach
        setTimeout(async () => {
          try {
            await loadSettings()
            console.log('Settings loaded successfully')
          } catch (error) {
            console.error('Failed to load settings:', error)
            // Non-fatal error, continue anyway
          }
        }, 100)

        // Set app as ready for user interaction immediately
        appInitialized = true
        setAppStatus('ready')
        console.log('App ready - UI can now be interacted with')
      } catch (error) {
        console.error('Failed to initialize app:', error)
        setAppStatus('error')
        setInitializationError(
          error instanceof Error ? error.message : 'Unknown error during initialization'
        )
      }
    })

    // Listen for the services:ready event (backends are fully initialized)
    window.electronAPI.app.onServicesReady(() => {
      console.log('Backend services fully initialized')
      setServicesReady(true)
    })

    // Set a more aggressive timeout for initialization
    setTimeout(() => {
      if (!appInitialized) {
        console.warn('App initialization timeout - forcing ready state')
        setAppStatus('ready')
      }
    }, 2000) // 2 second timeout
  }, [appStatus])

  // Special case - need to load settings from the settings context
  const loadSettings = async () => {
    // This will need to be implemented once the settings context is created
    // Here it's just a placeholder to maintain API compatibility
    console.log('loadSettings called from AppContext')
  }

  // Combine state and actions
  const contextValue: AppContextType = {
    appStatus,
    initializationError,
    servicesReady,
    initializeApp
  }

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

// Custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
