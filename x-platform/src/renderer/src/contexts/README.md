# React Context State Management

This application uses React's built-in Context API for state management. The state is divided into logical slices to maintain separation of concerns.

## Structure

- `AppContext`: Application initialization and status management
- `DocumentContext`: Document management and file uploads
- `ChatContext`: Chat and message management
- `SettingsContext`: Application settings

## Using Context in Components

For direct access to a specific context:

```tsx
import { useAppContext, useChatContext, useDocumentContext, useSettingsContext } from '@/contexts'

const MyComponent = () => {
  // Use specific context hooks
  const { appStatus, initializeApp } = useAppContext()
  const { documents, loadDocuments } = useDocumentContext()
  const { chats, sendMessage } = useChatContext()
  const { settings, updateSettings } = useSettingsContext()

  // Component implementation
}
```

## Legacy Compatibility Layer

A compatibility layer is provided for easier migration from Zustand:

```tsx
import { useStore } from '@/contexts'

const MyComponent = () => {
  // This provides all contexts merged together
  // Will display a deprecation warning in console
  const { documents, chats, settings } = useStore()

  // Component implementation
}
```

## App Context Provider

All components are wrapped with the combined context provider in the main application:

```tsx
<AppContextProvider>
  <App />
</AppContextProvider>
```

## Context Implementation

Each context uses `useState` hooks internally with action creators for any state updates that also involve API calls. This pattern keeps state management simple and predictable while allowing for asynchronous operations.

For example:

```tsx
// Inside a context provider
const [documents, setDocuments] = useState<Document[]>([])
const [isLoading, setIsLoading] = useState(false)

const loadDocuments = useCallback(async () => {
  setIsLoading(true)
  try {
    const docs = await window.electronAPI.documents.getAll()
    setDocuments(docs)
  } catch (error) {
    console.error('Failed to load documents:', error)
  } finally {
    setIsLoading(false)
  }
}, [])
```
