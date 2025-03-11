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
import { Toaster } from '@/components/ui/sonner'
import { useState, useMemo, useCallback, memo } from 'react'
import React from 'react'

interface LayoutProps {
  children: React.ReactNode
}

// Memoized NavLink component to prevent unnecessary rerenders
const NavItem = memo(
  ({
    item,
    isActive
  }: {
    item: { path: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
    isActive: boolean
    locationPath: string
  }) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.path}
        to={item.path}
        className={cn(
          'flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors',
          isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        )}
      >
        <Icon className="mr-2 h-5 w-5" />
        <span>{item.label}</span>
      </NavLink>
    )
  }
)

NavItem.displayName = 'NavItem'

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { theme, setTheme } = useTheme()
  const location = useLocation()

  // Memoize toggle sidebar function to prevent recreation on each render
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  // Memoize theme toggle functions
  const setLightTheme = useCallback(() => setTheme('light'), [setTheme])
  const setDarkTheme = useCallback(() => setTheme('dark'), [setTheme])
  const setSystemTheme = useCallback(() => setTheme('system'), [setTheme])

  // Memoize nav items to prevent recreation on each render
  const navItems = useMemo(
    () => [
      { path: '/', label: 'Dashboard', icon: Home },
      { path: '/upload', label: 'Upload', icon: Upload },
      { path: '/library', label: 'Library', icon: Book },
      { path: '/chat', label: 'Chat', icon: MessageSquare },
      { path: '/history', label: 'History', icon: History },
      { path: '/settings', label: 'Settings', icon: Settings }
    ],
    []
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar toggle */}
      <div className={cn('lg:hidden fixed top-4 left-4 z-40', sidebarOpen && 'hidden')}>
        <Button variant="outline" size="icon" onClick={toggleSidebar} aria-label="Toggle menu">
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
        // Optimize animation to reduce repaints
        animate={{
          width: sidebarOpen ? 240 : 0,
          opacity: sidebarOpen ? 1 : 0
        }}
        transition={{ type: 'tween', duration: 0.2 }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b px-4">
            <h1 className="text-xl font-bold">RetrievAI</h1>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
              className="lg:hidden"
            >
              {<X size={20} />}
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {useMemo(
              () =>
                navItems.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    isActive={item.path === location.pathname}
                    locationPath={location.pathname}
                  />
                )),
              [navItems, location.pathname]
            )}
          </nav>
          <div className="border-t p-4">
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={setLightTheme}
                className={theme === 'light' ? 'bg-muted' : ''}
              >
                <Sun className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={setDarkTheme}
                className={theme === 'dark' ? 'bg-muted' : ''}
              >
                <Moon className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={setSystemTheme}
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

      {/* Toast system */}
      <Toaster />
    </div>
  )
}

export default Layout
