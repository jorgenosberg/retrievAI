import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  Book,
  Upload,
  MessageSquare,
  History,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Laptop
} from 'lucide-react'
import { useTheme } from '@/theme/theme-provider'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { theme, setTheme } = useTheme()
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/upload', label: 'Upload', icon: Upload },
    { path: '/library', label: 'Library', icon: Book },
    { path: '/chat', label: 'Chat', icon: MessageSquare },
    { path: '/history', label: 'History', icon: History },
    { path: '/settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {/* Sidebar */}
      <motion.div
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 transform border-r bg-card transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        initial={false}
        animate={{
          width: sidebarOpen ? 240 : 0,
          opacity: sidebarOpen ? 1 : 0
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-4">
            <h1 className="text-xl font-bold">RetrievAI</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )
                  }
                >
                  <Icon className="mr-3 h-5 w-5" />
                  <span>{item.label}</span>
                  {item.path === location.pathname && (
                    <motion.div
                      className="absolute inset-y-0 left-0 w-1 bg-primary rounded-r-md"
                      layoutId="activeIndicator"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </NavLink>
              )
            })}
          </nav>
          <div className="border-t p-4">
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme('light')}
                className={theme === 'light' ? 'bg-muted' : ''}
              >
                <Sun className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme('dark')}
                className={theme === 'dark' ? 'bg-muted' : ''}
              >
                <Moon className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme('system')}
                className={theme === 'system' ? 'bg-muted' : ''}
              >
                <Laptop className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">{children}</div>
      </main>
    </div>
  )
}

export default Layout
