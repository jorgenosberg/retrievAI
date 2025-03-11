import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from '@/components/layout'
import DashboardPage from '@/pages/dashboard-page'
import UploadPage from '@/pages/upload-page'
import LibraryPage from '@/pages/library-page'
import ChatPage from '@/pages/chat-page'
import HistoryPage from '@/pages/history-page'
import SettingsPage from '@/pages/settings-page'
import { useStore } from '@/stores'
import Loading from './components/loading'
import { useShallow } from 'zustand/react/shallow'

function App(): JSX.Element {
  const appStatus = useStore(useShallow((state) => state.appStatus))

  if (appStatus === 'initializing' || appStatus === 'error') {
    return <Loading />
  }

  return (
    <>
      <Router>
        <Layout>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AnimatePresence>
        </Layout>
      </Router>
    </>
  )
}

export default App
