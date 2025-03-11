import { create } from 'zustand'
import { createAppSlice } from './slices/appSlice'
import { createDocumentSlice } from './slices/documentSlice'
import { createChatSlice } from './slices/chatSlice'
import { createSettingsSlice } from './slices/settingsSlice'
import { type AppState } from './types'

// Create the combined store with all slices
const useAppStore = create<AppState>()((...a) => ({
  ...createAppSlice(...a),
  ...createDocumentSlice(...a),
  ...createChatSlice(...a),
  ...createSettingsSlice(...a)
}))

export default useAppStore
