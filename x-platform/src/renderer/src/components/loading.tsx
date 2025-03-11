import { useEffect } from 'react'
import { useStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'

const Loading = () => {
  const { appStatus, initializationError, initializeApp } = useStore(
    useShallow((state) => ({
      appStatus: state.appStatus,
      initializationError: state.initializationError,
      initializeApp: state.initializeApp
    }))
  )

  useEffect(() => {
    // Initialize the app when the component mounts
    initializeApp()
  }, [initializeApp])

  if (appStatus === 'error') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Application Error</h2>
            <p className="mt-2 text-sm text-gray-600">
              There was a problem initializing the application
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {initializationError || 'Unknown error occurred during initialization'}
                </p>
                <p className="mt-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Retry
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-4">RetrievAI is starting up...</h1>

        {/* Spinner animation */}
        <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>

        <p className="text-muted-foreground">Loading your documents and initializing services...</p>
      </div>
    </div>
  )
}

export default Loading
