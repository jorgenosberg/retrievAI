import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense, memo, useEffect } from 'react'
import Layout from '@/components/layout'
import { useAppContext } from '@/contexts'
import Loading from './components/loading'

// Lazy load all pages to reduce initial load time
const DashboardPage = lazy(() => import('@/pages/dashboard-page'))
const UploadPage = lazy(() => import('@/pages/upload-page'))
const LibraryPage = lazy(() => import('@/pages/library-page'))
const ChatPage = lazy(() => import('@/pages/chat-page'))
const HistoryPage = lazy(() => import('@/pages/history-page'))
const SettingsPage = lazy(() => import('@/pages/settings-page'))

// Create a separate AnimatedRoutes component to properly handle route transitions
// This prevents unnecessary re-renders of the entire app
const AnimatedRoutes = memo(() => {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Suspense fallback={<Loading text="Loading page..." />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
})
AnimatedRoutes.displayName = 'AnimatedRoutes'

function App() {
  // Use app context
  const { appStatus, initializeApp } = useAppContext()

  // Initialize app only once
  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  if (appStatus === 'initializing' || appStatus === 'error') {
    return <Loading text="Initializing app..." initApp={true} />
  }

  return (
    <Router>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </Router>
  )
}

export default App
