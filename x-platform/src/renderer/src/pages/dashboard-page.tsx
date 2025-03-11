import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, MessageSquare, BookOpen, Clock } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDocumentContext, useChatContext } from '@/contexts'

interface Document {
  id: string
  name: string
  date: string
}

interface Chat {
  id: string
  title: string
  date: string
}

interface DashboardStats {
  documentsCount: number
  chatCount: number
  recentDocuments: Document[]
  recentChats: Chat[]
}

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats>({
    documentsCount: 0,
    chatCount: 0,
    recentDocuments: [],
    recentChats: []
  })
  const [loading, setLoading] = useState(true)

  // Use context hooks for data fetching
  const { documents, loadDocuments } = useDocumentContext()
  const { chats, loadChats } = useChatContext()

  // Separate data loading effect from data processing
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Create a promise for both data loading operations
        await Promise.all([loadDocuments(), loadChats()])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      }
    }

    loadInitialData()
  }, [loadDocuments, loadChats])

  // Memoize document processing
  const recentDocuments = useMemo(() => {
    if (!documents.length) return []

    return documents
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((doc) => ({
        id: doc.id,
        name: doc.title,
        date: new Date(doc.created_at).toISOString().split('T')[0]
      }))
  }, [documents])

  // Memoize chat processing
  const recentChats = useMemo(() => {
    if (!chats.length) return []

    return chats
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 2)
      .map((chat) => ({
        id: chat.id,
        title: chat.title || `Chat ${chat.id.substring(0, 8)}`,
        date: new Date(chat.created_at).toISOString().split('T')[0]
      }))
  }, [chats])

  // Update stats when processed data changes
  useEffect(() => {
    if (documents.length > 0 || chats.length > 0) {
      setStats({
        documentsCount: documents.length,
        chatCount: chats.length,
        recentDocuments,
        recentChats
      })
      setLoading(false)
    }
  }, [recentDocuments, recentChats, documents.length, chats.length])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link to="/upload">Upload New Documents</Link>
        </Button>
      </div>

      <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documentsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.chatCount}</div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Recent documents uploaded to your library</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {stats.recentDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span className="text-sm">{doc.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{doc.date}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild className="w-full">
                <Link to="/library">View Library</Link>
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Chats</CardTitle>
              <CardDescription>Your recent conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {stats.recentChats.map((chat) => (
                  <li key={chat.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
                      <span className="text-sm">{chat.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{chat.date}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild className="w-full">
                <Link to="/history">View History</Link>
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default DashboardPage
