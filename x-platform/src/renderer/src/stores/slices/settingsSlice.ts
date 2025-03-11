import { SettingsSliceCreator } from '../types'

export const createSettingsSlice: SettingsSliceCreator = (set) => ({
  // Initial state
  settings: {
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
  },

  // Settings actions
  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.settings.getAll()
      set({ settings })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  },

  updateSettings: async (newSettings) => {
    try {
      await window.electronAPI.settings.update(newSettings)

      // Update only the changed fields, not the entire settings object
      set((state) => ({
        settings: {
          ...state.settings,
          ...newSettings
        }
      }))
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  },

  setApiKey: async (provider, key) => {
    try {
      await window.electronAPI.settings.setApiKey(provider, key)
      // No need to update state as API keys aren't stored in the frontend
    } catch (error) {
      console.error('Failed to set API key:', error)
    }
  }
})
