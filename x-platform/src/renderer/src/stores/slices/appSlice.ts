import { AppSliceCreator } from '../types'

export const createAppSlice: AppSliceCreator = (set, get) => ({
  // Initial state
  appStatus: 'initializing',
  initializationError: null,

  // App initialization
  initializeApp: () => {
    // Listen for the app:ready event from the main process
    window.electronAPI.app.onReady(async () => {
      try {
        // Load initial data in parallel
        await Promise.all([get().loadSettings(), get().loadDocuments(), get().loadChats()])

        set({ appStatus: 'ready' })
      } catch (error) {
        console.error('Failed to initialize app:', error)
        set({
          appStatus: 'error',
          initializationError:
            error instanceof Error ? error.message : 'Unknown error during initialization'
        })
      }
    })

    // Set a shorter timeout for initialization
    setTimeout(() => {
      const { appStatus } = get()
      if (appStatus === 'initializing') {
        console.warn('App initialization timeout - forcing ready state')
        set({ appStatus: 'ready' })
      }
    }, 5000) // 5 second timeout (reduced from 15)
  }
})
