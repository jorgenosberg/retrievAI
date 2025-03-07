import { useState } from 'react'
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

// Define interfaces
interface ChatHistory {
  id: string
  title: string
  lastActive: Date
  messages: number
  previewText: string
  models: string[]
  documents: string[]
}

// Mock data for chat history
const mockChatHistory: ChatHistory[] = [
  {
    id: 'chat_1709650289',
    title: 'Machine Learning Survey Analysis',
    lastActive: new Date(2025, 2, 6, 14, 23),
    messages: 12,
    previewText: 'What are the key findings in the Machine Learning Survey?',
    models: ['Claude 3 Opus'],
    documents: ['Machine Learning Survey.pdf', 'Neural Networks Overview.pdf', 'Research Notes.txt']
  },
  {
    id: 'chat_1709563889',
    title: 'Neural Networks vs Transformers',
    lastActive: new Date(2025, 2, 5, 10, 45),
    messages: 8,
    previewText: 'Compare neural networks and transformers architectures',
    models: ['Claude 3 Opus', 'Claude 3 Sonnet'],
    documents: ['Neural Networks Overview.pdf', 'Transformers Architecture.docx']
  },
  {
    id: 'chat_1709477489',
    title: 'Data Visualization Techniques',
    lastActive: new Date(2025, 2, 4, 16, 12),
    messages: 14,
    previewText: 'Summarize the best data visualization techniques for scientific research',
    models: ['GPT-4 Turbo'],
    documents: ['Data Visualization Techniques.pdf', 'Research Notes.txt']
  },
  {
    id: 'chat_1709391089',
    title: 'Research Project Planning',
    lastActive: new Date(2025, 2, 3, 9, 30),
    messages: 6,
    previewText: 'Help me plan a research project on deep learning applications',
    models: ['Claude 3 Sonnet'],
    documents: ['Machine Learning Survey.pdf', 'Research Notes.txt']
  },
  {
    id: 'chat_1709304689',
    title: 'Literature Review Assistance',
    lastActive: new Date(2025, 2, 2, 13, 45),
    messages: 18,
    previewText: 'Can you help me organize a literature review on neural networks?',
    models: ['GPT-4 Turbo', 'Claude 3 Opus'],
    documents: ['Neural Networks Overview.pdf', 'Machine Learning Survey.pdf', 'Research Notes.txt']
  },
  {
    id: 'chat_1709131889',
    title: 'Research Questions Formulation',
    lastActive: new Date(2025, 2, 1, 11, 20),
    messages: 10,
    previewText: 'How can I formulate effective research questions for my ML project?',
    models: ['Claude 3 Opus'],
    documents: ['Machine Learning Survey.pdf', 'Research Notes.txt']
  },
  {
    id: 'chat_1708958289',
    title: 'Statistical Analysis Methods',
    lastActive: new Date(2025, 1, 28, 15, 10),
    messages: 7,
    previewText: 'What statistical methods should I use to analyze my experimental results?',
    models: ['GPT-3.5 Turbo'],
    documents: ['Research Notes.txt', 'Data Visualization Techniques.pdf']
  }
]

const HistoryPage = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [history, setHistory] = useState<ChatHistory[]>(mockChatHistory)
  const [selectedChats, setSelectedChats] = useState<string[]>([])
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'alphabetical'>('newest')
  const [filterModel, setFilterModel] = useState<string | null>(null)
  const [filterDocument, setFilterDocument] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Extract unique models and documents for filters
  const uniqueModels = Array.from(new Set(history.flatMap((chat) => chat.models))).sort()
  const uniqueDocuments = Array.from(new Set(history.flatMap((chat) => chat.documents))).sort()

  // Filter and sort history
  const filteredHistory = history
    .filter((chat) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.previewText.toLowerCase().includes(searchQuery.toLowerCase())

      // Model filter
      const matchesModel = !filterModel || chat.models.includes(filterModel)

      // Document filter
      const matchesDocument = !filterDocument || chat.documents.includes(filterDocument)

      return matchesSearch && matchesModel && matchesDocument
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

  const deleteSelectedChats = () => {
    setHistory((prev) => prev.filter((chat) => !selectedChats.includes(chat.id)))
    setSelectedChats([])
    setIsSelectMode(false)
    setDeleteDialogOpen(false)
    toast.success(
      `Deleted ${selectedChats.length} conversation${selectedChats.length > 1 ? 's' : ''}`
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterModel(null)
    setFilterDocument(null)
    setSortOrder('newest')
  }

  const openChat = (id: string) => {
    // In a real app, you would navigate to the chat page with the chat ID
    navigate(`/chat/${id}`)
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
                <Button variant="ghost" size="sm" onClick={() => navigate('/chat')}>
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
                <DropdownMenuItem className="font-semibold">Model</DropdownMenuItem>
                {uniqueModels.map((model) => (
                  <DropdownMenuCheckboxItem
                    key={model}
                    checked={filterModel === model}
                    onCheckedChange={() => setFilterModel(filterModel === model ? null : model)}
                  >
                    {model}
                  </DropdownMenuCheckboxItem>
                ))}

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

        {/* Chat history list */}
        {filteredHistory.length === 0 ? (
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
                          <div className="flex flex-wrap gap-2">
                            {chat.models.map((model) => (
                              <Badge key={model} variant="outline" className="text-xs">
                                {model}
                              </Badge>
                            ))}
                          </div>
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
