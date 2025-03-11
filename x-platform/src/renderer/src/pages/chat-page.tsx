import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  ArrowRight,
  Info,
  Copy,
  Paperclip,
  FileText,
  ExternalLink,
  X,
  Settings,
  RefreshCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'

// Document with selection state for UI
interface DocumentFilter {
  id: string
  title: string // used as name in UI
  selected: boolean
  tags: string[]
}

interface ModelOption {
  id: string
  name: string
  provider: string
  description: string
}

const ChatPage = () => {
  const [input, setInput] = useState('')
  const [documents, setDocuments] = useState<DocumentFilter[]>([])
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get store hooks with useShallow for optimization
  const {
    createChat,
    chats,
    currentChatId,
    messages,
    loadMessages,
    sendMessage,
    loadDocuments,
    loadSettings,
    settings,
    isGeneratingResponse,
    documents: storeDocuments
  } = useStore(
    useShallow((state) => ({
      createChat: state.createChat,
      chats: state.chats,
      currentChatId: state.currentChatId,
      messages: state.messages,
      loadMessages: state.loadMessages,
      sendMessage: state.sendMessage,
      loadDocuments: state.loadDocuments,
      loadSettings: state.loadSettings,
      settings: state.settings,
      isGeneratingResponse: state.isGeneratingResponse,
      documents: state.documents
    }))
  )

  // Get current chat messages
  const currentMessages = useMemo(
    () => (currentChatId ? messages[currentChatId] || [] : []),
    [currentChatId, messages]
  )

  // Initialize app on component mount
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Load documents from the document store
        await loadDocuments()

        // Fetch settings to get model information
        await loadSettings()

        // Get available models from settings
        if (settings.defaultModel) {
          setModelOptions([
            {
              id: settings.defaultModel.model,
              name: settings.defaultModel.model,
              provider: settings.defaultModel.provider,
              description: `${settings.defaultModel.provider} model`
            }
          ])
          setSelectedModel(settings.defaultModel.model)
        }

        // Convert API documents to DocumentFilter format
        const filterDocs: DocumentFilter[] = storeDocuments.map((doc) => ({
          id: doc.id,
          title: doc.title || 'Unknown document',
          selected: true,
          tags: doc.tags || []
        }))

        setDocuments(filterDocs)

        // Extract all unique tags
        const tags = Array.from(new Set(filterDocs.flatMap((doc) => doc.tags))).sort()
        setAllTags(tags)
      } catch (error) {
        console.error('Error initializing chat:', error)
        toast.error('Failed to load chat resources')
      }
    }

    initializeChat()
  }, [loadDocuments, loadSettings, settings.defaultModel, storeDocuments])

  // Create a new chat when component mounts if no current chat exists
  useEffect(() => {
    const createNewChat = async () => {
      try {
        await createChat('New Research Chat')
      } catch (error) {
        console.error('Error creating chat:', error)
        toast.error('Failed to create new chat session')
      }
    }

    if (!currentChatId && chats.length === 0) {
      createNewChat()
    } else if (currentChatId && !messages[currentChatId]) {
      // Load messages for the current chat if they're not loaded yet
      loadMessages(currentChatId)
    }
  }, [currentChatId, createChat, chats.length, messages, loadMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentMessages])

  const handleSendMessage = async () => {
    if (!input.trim() || isGeneratingResponse || !currentChatId || !selectedModel) return

    // Get selected document IDs
    const selectedDocIds = documents.filter((doc) => doc.selected).map((doc) => doc.id)

    try {
      // Send message using the store method
      await sendMessage(currentChatId, input, selectedDocIds)
      setInput('')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to generate a response. Please try again.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleDocumentSelection = (id: string) => {
    setDocuments((docs) =>
      docs.map((doc) => (doc.id === id ? { ...doc, selected: !doc.selected } : doc))
    )
  }

  const toggleTagFilter = (tag: string) => {
    setFilterTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const selectAllDocuments = (selected: boolean) => {
    setDocuments((docs) => docs.map((doc) => ({ ...doc, selected })))
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard')
  }

  const filteredDocuments = documents.filter((doc) => {
    if (filterTags.length === 0) return true
    return filterTags.every((tag) => doc.tags.includes(tag))
  })

  const clearChat = async () => {
    try {
      // Create a new chat
      await createChat('New Research Chat')
    } catch (error) {
      console.error('Error creating new chat:', error)
      toast.error('Failed to create new chat session')
    }
  }

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col h-full overflow-hidden"
      >
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold">Research Assistant</h2>
            <Badge variant="outline" className="ml-2">
              {modelOptions.find((m) => m.id === selectedModel)?.name || 'AI Model'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={clearChat}>
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>New Chat</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Chat Settings</SheetTitle>
                  <SheetDescription>Configure your chat experience</SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="model" className="mt-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="model">AI Model</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                  </TabsList>

                  <TabsContent value="model" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Select AI Model</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose the AI model that best suits your research needs.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {modelOptions.map((model) => (
                        <Card
                          key={model.id}
                          className={cn(
                            'cursor-pointer hover:border-primary transition-colors',
                            selectedModel === model.id && 'border-primary bg-primary/5'
                          )}
                          onClick={() => setSelectedModel(model.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{model.name}</h4>
                                <p className="text-sm text-muted-foreground">{model.provider}</p>
                              </div>
                              {selectedModel === model.id && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="text-sm mt-2">{model.description}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Filter by Documents</h3>
                        <div className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectAllDocuments(true)}
                          >
                            Select All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectAllDocuments(false)}
                          >
                            Deselect All
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Select which documents to include in the search context.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {allTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant={filterTags.includes(tag) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => toggleTagFilter(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {filteredDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50"
                          >
                            <Checkbox
                              id={`doc-${doc.id}`}
                              checked={doc.selected}
                              onCheckedChange={() => toggleDocumentSelection(doc.id)}
                            />
                            <Label htmlFor={`doc-${doc.id}`} className="flex-1 cursor-pointer">
                              <div className="font-medium">{doc.title}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {doc.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <SheetFooter className="mt-6">
                  <SheetClose asChild>
                    <Button>Apply Settings</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-md space-y-4"
              >
                <h3 className="text-2xl font-bold">Welcome to Research Assistant</h3>
                <p className="text-muted-foreground">
                  Ask questions about your research documents to get AI-powered insights and
                  answers.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="font-medium">Example questions to get started:</p>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() =>
                      setInput('What are the key findings in the Machine Learning Survey?')
                    }
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    What are the key findings in the Machine Learning Survey?
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() =>
                      setInput('Compare neural networks and transformers architectures')
                    }
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Compare neural networks and transformers architectures
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() =>
                      setInput(
                        'Summarize the best data visualization techniques for scientific research'
                      )
                    }
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Summarize the best data visualization techniques for scientific research
                  </Button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              <AnimatePresence>
                {currentMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'flex flex-col max-w-[80%] space-y-2',
                        message.role === 'user' ? 'items-end' : 'items-start'
                      )}
                    >
                      <div
                        className={cn(
                          'rounded-lg px-4 py-3 shadow-sm',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          {message.role === 'assistant' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopyMessage(message.content)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Citations */}
                      {message.role === 'assistant' &&
                        message.citations &&
                        message.citations.length > 0 && (
                          <div className="space-y-1 w-full">
                            <p className="text-xs text-muted-foreground">
                              Citations from {message.citations.length} document
                              {message.citations.length !== 1 ? 's' : ''}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {message.citations.map((citation) => (
                                <Badge
                                  key={citation.id}
                                  variant="outline"
                                  className={cn(
                                    'cursor-pointer text-xs py-1 px-2 gap-1.5 hover:bg-primary/10 transition-colors',
                                    selectedCitation === citation.id &&
                                      'bg-primary/10 border-primary/50'
                                  )}
                                  onClick={() =>
                                    setSelectedCitation(
                                      citation.id === selectedCitation ? null : citation.id
                                    )
                                  }
                                >
                                  <FileText className="h-3 w-3" />
                                  <span className="truncate max-w-[120px]">
                                    {citation.document_id}
                                  </span>
                                </Badge>
                              ))}
                            </div>

                            <AnimatePresence>
                              {selectedCitation && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2"
                                >
                                  {message.citations
                                    .filter((c) => c.id === selectedCitation)
                                    .map((citation) => (
                                      <div
                                        key={citation.id}
                                        className="p-3 rounded border bg-muted/50 text-sm relative"
                                      >
                                        <div className="absolute top-2 right-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => setSelectedCitation(null)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <div className="font-medium mb-1 pr-8">
                                          {citation.document_id}
                                        </div>
                                        <div className="text-muted-foreground">
                                          {citation.document_id}
                                        </div>
                                        <div className="mt-2 flex justify-between items-center">
                                          <Badge variant="outline" className="text-xs">
                                            Confidence: {Math.round(citation.confidence * 100)}%
                                          </Badge>
                                          <Button variant="ghost" size="sm" className="h-7">
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            View in document
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isGeneratingResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-lg px-4 py-3 shadow-sm max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <motion.div
                          animate={{
                            opacity: [0.4, 1, 0.4],
                            scale: [0.8, 1, 0.8]
                          }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: 0
                          }}
                          className="w-2 h-2 rounded-full bg-current"
                        />
                        <motion.div
                          animate={{
                            opacity: [0.4, 1, 0.4],
                            scale: [0.8, 1, 0.8]
                          }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: 0.2
                          }}
                          className="w-2 h-2 rounded-full bg-current"
                        />
                        <motion.div
                          animate={{
                            opacity: [0.4, 1, 0.4],
                            scale: [0.8, 1, 0.8]
                          }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: 0.4
                          }}
                          className="w-2 h-2 rounded-full bg-current"
                        />
                      </div>
                      <span className="text-sm">
                        Searching documents and generating response...
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Ask about your documents..."
                  className="min-h-[80px] resize-none pr-12"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isGeneratingResponse}
                />
                <div className="absolute right-3 bottom-3">
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isGeneratingResponse}
                    onClick={handleSendMessage}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-2 flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="link" size="sm" className="p-0 h-auto">
                        <Info className="h-3 w-3 mr-1" />
                        Using {documents.filter((d) => d.selected).length} documents
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Current search includes {documents.filter((d) => d.selected).length}{' '}
                        documents
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div>
                <Button variant="ghost" size="sm" className="h-7">
                  <Paperclip className="h-3 w-3 mr-1" />
                  Attach
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default ChatPage
