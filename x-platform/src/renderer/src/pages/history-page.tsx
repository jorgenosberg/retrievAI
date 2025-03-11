import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Trash2,
  Calendar,
  Clock,
  FileText,
  ChevronRight,
  Filter,
  X,
  ArrowUpDown,
  RefreshCcw
} from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import useStore from '@/stores'
import { useShallow } from 'zustand/react/shallow'

const HistoryPage = () => {
  const navigate = useNavigate()

  // Get store data with useShallow for optimization
  const { chats, messages, deleteChat, loadChats, loadMessages, createChat } = useStore(
    useShallow((state) => ({
      chats: state.chats,
      messages: state.messages,
      deleteChat: state.deleteChat,
      loadChats: state.loadChats,
      loadMessages: state.loadMessages,
      createChat: state.createChat
    }))
  )

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChats, setSelectedChats] = useState<string[]>([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'alphabetical'>('newest')
  const [filterModel, setFilterModel] = useState<string | null>(null)
  const [filterDocument, setFilterDocument] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load chats from the store when component mounts
  useEffect(() => {
    const fetchChats = async () => {
      setIsLoading(true)
      try {
        await loadChats()
      } catch (error) {
        console.error('Error loading chats:', error)
        toast.error('Failed to load conversation history')
      } finally {
        setIsLoading(false)
      }
    }

    fetchChats()
  }, [loadChats])

  // Transform chat data for display
  const chatHistory = chats.map((chat) => {
    // Get messages for this chat
    const chatMessages = messages[chat.id] || []

    // Extract document names (unique)
    const documentNames = Array.from(
      new Set(
        chatMessages.flatMap((msg) => msg.citations || []).map((citation) => citation.document_id)
      )
    ).filter(Boolean)

    // Get preview text from the last message
    const lastMessage = chatMessages[chatMessages.length - 1]
    const previewText = lastMessage?.content || 'No messages'

    return {
      id: chat.id,
      title: chat.title || 'Untitled Conversation',
      lastActive: new Date(chat.updated_at || chat.created_at),
      messages: chatMessages.length,
      previewText: previewText.slice(0, 100) + (previewText.length > 100 ? '...' : ''),
      documents: documentNames
    }
  })

  const uniqueDocuments = Array.from(new Set(chatHistory.flatMap((chat) => chat.documents))).sort()

  // Filter and sort history
  const filteredHistory = chatHistory
    .filter((chat) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.previewText.toLowerCase().includes(searchQuery.toLowerCase())

      // Document filter
      const matchesDocument = !filterDocument || chat.documents.includes(filterDocument)

      return matchesSearch && matchesDocument
    })
    .sort((a, b) => {
      // Sort based on selected order
      if (sortOrder === 'newest') {
        return b.lastActive.getTime() - a.lastActive.getTime()
      } else if (sortOrder === 'oldest') {
        return a.lastActive.getTime() - b.lastActive.getTime()
      } else {
        return a.title.localeCompare(b.title)
      }
    })

  const toggleChatSelection = (id: string) => {
    setSelectedChats((prev) =>
      prev.includes(id) ? prev.filter((chatId) => chatId !== id) : [...prev, id]
    )
  }

  const selectAllChats = () => {
    if (selectedChats.length === filteredHistory.length) {
      setSelectedChats([])
    } else {
      setSelectedChats(filteredHistory.map((chat) => chat.id))
    }
  }

  const deleteSelectedChats = async () => {
    try {
      // Delete each selected chat via the store method
      await Promise.all(selectedChats.map((chatId) => deleteChat(chatId)))

      setSelectedChats([])
      setIsSelectMode(false)
      setDeleteDialogOpen(false)
      toast.success(
        `Deleted ${selectedChats.length} conversation${selectedChats.length > 1 ? 's' : ''}`
      )
    } catch (error) {
      console.error('Error deleting chats:', error)
      toast.error('Failed to delete conversations')
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterModel(null)
    setFilterDocument(null)
    setSortOrder('newest')
  }

  const openChat = async (id: string) => {
    try {
      // Load messages for this chat
      await loadMessages(id)
      // Navigate to the chat page
      navigate(`/chat/${id}`)
    } catch (error) {
      console.error('Error opening chat:', error)
      toast.error('Failed to open conversation')
    }
  }

  const handleNewChat = async () => {
    try {
      const newChatId = await createChat('New Research Chat')
      navigate(`/chat/${newChatId}`)
    } catch (error) {
      console.error('Error creating chat:', error)
      toast.error('Failed to create new chat')
    }
  }

  const areFiltersActive =
    searchQuery !== '' || filterModel !== null || filterDocument !== null || sortOrder !== 'newest'

  return (
    <div className="container py-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Conversation History</h1>
          <div className="flex items-center gap-2">
            {isSelectMode ? (
              <>
                <Button variant="outline" size="sm" onClick={selectAllChats}>
                  {selectedChats.length === filteredHistory.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={selectedChats.length === 0}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete {selectedChats.length > 0 ? `(${selectedChats.length})` : ''}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Conversations</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete {selectedChats.length} selected conversation
                        {selectedChats.length > 1 ? 's' : ''}? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={deleteSelectedChats}>
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsSelectMode(false)
                    setSelectedChats([])
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsSelectMode(true)}>
                  Select
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNewChat}>
                  <RefreshCcw className="h-4 w-4 mr-1" />
                  New Chat
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem
                  checked={sortOrder === 'newest'}
                  onCheckedChange={() => setSortOrder('newest')}
                >
                  Newest first
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortOrder === 'oldest'}
                  onCheckedChange={() => setSortOrder('oldest')}
                >
                  Oldest first
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortOrder === 'alphabetical'}
                  onCheckedChange={() => setSortOrder('alphabetical')}
                >
                  Alphabetical
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('gap-1', (filterModel || filterDocument) && 'bg-primary/10')}
                >
                  <Filter className="h-4 w-4" />
                  Filter
                  {(filterModel || filterDocument) && (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 h-5">
                      {(filterModel ? 1 : 0) + (filterDocument ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuSeparator />

                <DropdownMenuItem className="font-semibold">Document</DropdownMenuItem>
                {uniqueDocuments.map((document) => (
                  <DropdownMenuCheckboxItem
                    key={document}
                    checked={filterDocument === document}
                    onCheckedChange={() =>
                      setFilterDocument(filterDocument === document ? null : document)
                    }
                  >
                    {document}
                  </DropdownMenuCheckboxItem>
                ))}

                {areFiltersActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={clearFilters}
                      className="justify-center text-primary"
                    >
                      Clear all filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {areFiltersActive && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {sortOrder !== 'newest' && (
                <Badge variant="secondary" className="gap-1">
                  {sortOrder === 'oldest' ? 'Oldest first' : 'Alphabetical'}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setSortOrder('newest')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {filterModel && (
                <Badge variant="secondary" className="gap-1">
                  Model: {filterModel}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setFilterModel(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {filterDocument && (
                <Badge variant="secondary" className="gap-1">
                  Document: {filterDocument}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setFilterDocument(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}

              {areFiltersActive && (
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearFilters}>
                  Clear all
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex items-center space-x-2 animate-pulse">
              <div className="w-4 h-4 rounded-full bg-primary" />
              <div className="w-4 h-4 rounded-full bg-primary/80" />
              <div className="w-4 h-4 rounded-full bg-primary/60" />
            </div>
            <p className="text-muted-foreground mt-4">Loading conversations...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No conversations found</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              {searchQuery || filterModel || filterDocument
                ? 'Try adjusting your filters or search query'
                : 'Start a new conversation to see it here'}
            </p>
            {(searchQuery || filterModel || filterDocument) && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((chat) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={cn(
                    'transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer',
                    isSelectMode &&
                      selectedChats.includes(chat.id) &&
                      'border-primary bg-primary/10'
                  )}
                  onClick={() => (isSelectMode ? toggleChatSelection(chat.id) : openChat(chat.id))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {isSelectMode && (
                        <Checkbox
                          checked={selectedChats.includes(chat.id)}
                          onCheckedChange={() => toggleChatSelection(chat.id)}
                          className="mt-1"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium truncate pr-2">{chat.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 mr-1" />
                              {format(chat.lastActive, 'MMM d, yyyy')}
                            </div>
                            {!isSelectMode && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {chat.previewText}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(chat.lastActive, 'h:mm a')}
                            </div>
                            <div className="flex items-center">
                              <FileText className="h-3 w-3 mr-1" />
                              {chat.messages} message{chat.messages !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default HistoryPage
