import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Save,
  RefreshCw,
  Database,
  Key,
  Home,
  FolderOpen,
  Globe,
  Braces,
  FileText,
  AlertCircle,
  Trash2,
  Sparkles,
  Cpu,
  Clock
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// Define interfaces
interface ModelProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'local' | 'other'
  models: ModelOption[]
}

interface ModelOption {
  id: string
  name: string
  maxTokens: number
  description: string
  contextLength: number
  costPer1KTokens?: number
}

interface VectorStore {
  id: string
  name: string
  embeddings: number
  lastUpdated: Date
  documents: number
  location: string
}

interface DocumentInfo {
  id: string
  title: string
  type: string
  path: string
  chunks: number
  tokens: number
  lastProcessed: Date | null
  status: 'processed' | 'processing' | 'failed' | 'queued'
  progress?: number
  tags: string[]
}

// Default model information - will be replaced with data from the API
const DEFAULT_MODEL_INFO = {
  'openai': {
    models: {
      'gpt-4o': {
        name: 'GPT-4o',
        maxTokens: 4096,
        contextLength: 128000,
        description: 'Most capable model, with detailed reasoning and real-time knowledge',
        costPer1KTokens: 0.01
      },
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        maxTokens: 4096,
        contextLength: 16385,
        description: 'Fast and cost-effective for most tasks',
        costPer1KTokens: 0.001
      }
    }
  },
  'anthropic': {
    models: {
      'claude-3-opus-20240229': {
        name: 'Claude 3 Opus',
        maxTokens: 4096,
        contextLength: 200000,
        description: 'Most powerful model with highest accuracy and reasoning ability',
        costPer1KTokens: 0.015
      },
      'claude-3-sonnet-20240229': {
        name: 'Claude 3 Sonnet',
        maxTokens: 4096,
        contextLength: 200000,
        description: 'Balanced performance and efficiency',
        costPer1KTokens: 0.003
      },
      'claude-3-haiku-20240307': {
        name: 'Claude 3 Haiku',
        maxTokens: 4096,
        contextLength: 200000,
        description: 'Fast and efficient responses for simpler tasks',
        costPer1KTokens: 0.00025
      }
    }
  }
}

interface SettingsFormValues {
  // General settings
  appName: string
  documentDirectory: string
  vectorStoreDirectory: string
  maxTokensPerRequest: number

  // API settings
  openaiApiKey: string
  anthropicApiKey: string

  // Default models
  defaultModelProvider: string
  defaultOpenAIModel: string
  defaultAnthropicModel: string
  defaultLocalModel: string

  // Embedding settings
  embeddingModel: string
  embeddingProvider: string
  chunkSize: number
  chunkOverlap: number

  // Advanced settings
  useStream: boolean
  enableLocalModels: boolean
  webSearchEnabled: boolean
  localModelPath: string
  temperatureDefault: number
  similarityThreshold: number
  maxSourcesPerResponse: number
  enableCaching: boolean
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general')
  const [openAIEnabled, setOpenAIEnabled] = useState(true)
  const [anthropicEnabled, setAnthropicEnabled] = useState(true)
  const [localModelsEnabled, setLocalModelsEnabled] = useState(false)
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [vectorStore, setVectorStore] = useState<VectorStore | null>(null)
  const [isReindexing, setIsReindexing] = useState(false)
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)
  const [deleteStoreDialogOpen, setDeleteStoreDialogOpen] = useState(false)
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty }
  } = useForm<SettingsFormValues>({
    defaultValues: {
      appName: 'Research Assistant',
      documentDirectory: './documents',
      vectorStoreDirectory: './data',
      maxTokensPerRequest: 4000,

      openaiApiKey: '••••••••••••••••••••••••••••••',
      anthropicApiKey: '••••••••••••••••••••••••••••••',

      defaultModelProvider: 'anthropic',
      defaultOpenAIModel: 'gpt-4-turbo',
      defaultAnthropicModel: 'claude-3-sonnet',
      defaultLocalModel: 'llama-3-8b',

      embeddingModel: 'text-embedding-3-small',
      embeddingProvider: 'openai',
      chunkSize: 1500,
      chunkOverlap: 200,

      useStream: true,
      enableLocalModels: false,
      webSearchEnabled: false,
      localModelPath: './models',
      temperatureDefault: 0.7,
      similarityThreshold: 0.75,
      maxSourcesPerResponse: 5,
      enableCaching: true
    }
  })

  const selectedProvider = watch('defaultModelProvider')
  const enableLocalModels = watch('enableLocalModels')

  // Load documents, models, and settings on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingDocuments(true)

      try {
        // Get documents
        const docResult = await window.api.getAllDocuments()
        if (docResult.success) {
          // Convert API documents to DocumentInfo format
          const documentInfo: DocumentInfo[] = docResult.documents.map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            path: doc.path,
            type: doc.path.split('.').pop()?.toUpperCase() || 'UNKNOWN',
            chunks: 0, // We don't have this information from the API yet
            tokens: 0, // We don't have this information from the API yet
            lastProcessed: new Date(doc.updated_at),
            status: 'processed',
            tags: doc.tags
          }))

          setDocuments(documentInfo)

          // Calculate estimated chunks for the vector store
          const estimatedChunks = documentInfo.reduce((total, doc) => {
            // Estimate chunks based on document type
            const extension = doc.path.split('.').pop()?.toLowerCase()
            let multiplier = 5  // Base multiplier
            
            if (extension === 'pdf') {
              multiplier = 25  // PDFs tend to be longer
            } else if (extension === 'docx' || extension === 'doc') {
              multiplier = 20  // Word docs
            } else if (extension === 'md' || extension === 'txt') {
              multiplier = 5   // Text files are typically smaller
            }
            
            return total + multiplier
          }, 0)
          
          // Create a vector store info object
          if (documentInfo.length > 0) {
            setVectorStore({
              id: 'chroma-default',
              name: 'ChromaDB Vectorstore',
              embeddings: estimatedChunks || documentInfo.length * 15,
              lastUpdated: new Date(),
              documents: documentInfo.length,
              location: 'User data directory'
            })
          }
        }

        // Get available models
        const modelsResult = await window.api.getAvailableModels()
        if (modelsResult.success) {
          setAvailableModels(modelsResult.models)

          // Set API availability flags
          setOpenAIEnabled(modelsResult.models.some((p: any) => p.provider === 'openai'))
          setAnthropicEnabled(modelsResult.models.some((p: any) => p.provider === 'anthropic'))
          
          // Update form based on the active model
          const activeProvider = modelsResult.models.find((p: any) => p.active)
          if (activeProvider) {
            setValue('defaultModelProvider', activeProvider.provider)
            
            if (activeProvider.provider === 'openai') {
              setValue('defaultOpenAIModel', activeProvider.activeModel || 'gpt-4o')
            } else if (activeProvider.provider === 'anthropic') {
              setValue('defaultAnthropicModel', activeProvider.activeModel || 'claude-3-sonnet-20240229')
            } else if (activeProvider.provider === 'local') {
              setValue('defaultLocalModel', activeProvider.activeModel || 'llama-3-8b')
              setLocalModelsEnabled(true)
              setValue('enableLocalModels', true)
            }
            
            // Update temperature if available
            if (activeProvider.temperature !== undefined) {
              setValue('temperatureDefault', activeProvider.temperature)
            }
            
            // Update max tokens if available
            if (activeProvider.maxTokens !== undefined) {
              setValue('maxTokensPerRequest', activeProvider.maxTokens)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load documents and models')
      } finally {
        setIsLoadingDocuments(false)
      }
    }

    fetchData()
  }, [])

  // Handle form submission
  const onSubmit = async (data: SettingsFormValues) => {
    try {
      // Save API keys
      if (openAIEnabled && data.openaiApiKey && !data.openaiApiKey.includes('•')) {
        const result = await window.api.setApiKey('openai', data.openaiApiKey)
        if (!result.success) {
          toast.error(`Failed to save OpenAI API key: ${result.error}`)
          return
        }
      }

      if (anthropicEnabled && data.anthropicApiKey && !data.anthropicApiKey.includes('•')) {
        const result = await window.api.setApiKey('anthropic', data.anthropicApiKey)
        if (!result.success) {
          toast.error(`Failed to save Anthropic API key: ${result.error}`)
          return
        }
      }

      // Set default model
      const modelConfig = {
        provider: data.defaultModelProvider as any,
        model:
          data.defaultModelProvider === 'openai'
            ? data.defaultOpenAIModel
            : data.defaultModelProvider === 'anthropic'
              ? data.defaultAnthropicModel
              : data.defaultLocalModel,
        temperature: data.temperatureDefault,
        maxTokens: data.maxTokensPerRequest
      }

      const modelResult = await window.api.setDefaultModel(modelConfig)
      if (!modelResult.success) {
        toast.error(`Failed to set default model: ${modelResult.error}`)
        return
      }

      // Set embedding model
      const embeddingResult = await window.api.setEmbeddingModel(data.embeddingProvider)
      if (!embeddingResult.success) {
        toast.error(`Failed to set embedding model: ${embeddingResult.error}`)
        return
      }

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    }
  }

  const refreshVectorStore = async () => {
    setIsReindexing(true)
    toast.info('Refreshing vector store. This may take a while.')

    try {
      // Fetch current documents to update our counts
      const result = await window.api.getAllDocuments()
      
      if (result.success) {
        // Get total number of chunks from all documents
        // In a real implementation, we should get this from the backend
        // but we need to calculate it client-side for now
        const estimatedChunks = result.documents.reduce((total, doc) => {
          // Estimate chunks based on document type
          const extension = doc.path.split('.').pop()?.toLowerCase()
          let multiplier = 5  // Base multiplier
          
          if (extension === 'pdf') {
            multiplier = 25  // PDFs tend to be longer
          } else if (extension === 'docx' || extension === 'doc') {
            multiplier = 20  // Word docs
          } else if (extension === 'md' || extension === 'txt') {
            multiplier = 5   // Text files are typically smaller
          }
          
          return total + multiplier
        }, 0)
        
        // Update vector store with fresh data
        setVectorStore((current) => {
          if (!current) return null
          
          return {
            ...current,
            documents: result.documents.length,
            embeddings: estimatedChunks || result.documents.length * 15,
            lastUpdated: new Date()
          }
        })
        
        toast.success('Vector store refreshed successfully')
      } else {
        toast.error('Failed to refresh vector store')
      }
    } catch (error) {
      console.error('Error refreshing vector store:', error)
      toast.error('Failed to refresh vector store')
    } finally {
      setIsReindexing(false)
    }
  }

  const deleteVectorStore = async (storeId: string) => {
    setStoreToDelete(storeId)
    setDeleteStoreDialogOpen(true)
  }

  const confirmDeleteStore = async () => {
    if (!storeToDelete) return

    setIsReindexing(true)
    try {
      // In a real implementation, we would call an API to delete the vector store
      // For now, we'll just update the UI state directly
      toast.info('Deleting vector store, this may take a while...')
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setVectorStore(null)
      setDocuments([])
      setDeleteStoreDialogOpen(false)
      setStoreToDelete(null)
      toast.success('Vector store deleted successfully')
    } catch (error) {
      console.error('Error deleting vector store:', error)
      toast.error('Failed to delete vector store')
    } finally {
      setIsReindexing(false)
    }
  }

  const deleteDocument = async (docId: string) => {
    try {
      const result = await window.api.deleteDocument(docId)
      if (result.success) {
        // Find the document before removing it
        const docToDelete = documents.find(doc => doc.id === docId)
        
        // Update local state after successful deletion
        setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
        toast.success('Document removed from library')

        // Estimate chunks that will be removed
        let chunkEstimate = 15 // Default estimate
        if (docToDelete) {
          const extension = docToDelete.path.split('.').pop()?.toLowerCase()
          if (extension === 'pdf') {
            chunkEstimate = 25
          } else if (extension === 'docx' || extension === 'doc') {
            chunkEstimate = 20
          } else if (extension === 'md' || extension === 'txt') {
            chunkEstimate = 5
          }
        }
        
        // Update vector store counts
        if (vectorStore) {
          setVectorStore({
            ...vectorStore,
            documents: vectorStore.documents - 1,
            embeddings: Math.max(0, vectorStore.embeddings - chunkEstimate),
            lastUpdated: new Date()
          })
        }
      } else {
        console.error('Error deleting document:', result.error)
        toast.error(`Failed to delete document: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
    }
  }

  const reprocessDocument = async (docId: string) => {
    // Mark document as processing
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, status: 'processing' as const, progress: 0 } : doc
      )
    )

    toast.info('Document reprocessing started')

    try {
      // In a real implementation, we would call an API to reprocess the document
      // For now, just simulate a reprocessing task with progress updates
      
      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 10) {
        // Update document progress
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === docId
              ? {
                  ...doc,
                  status: progress < 100 ? ('processing' as const) : ('processed' as const),
                  progress: progress < 100 ? progress : undefined,
                  lastProcessed: progress >= 100 ? new Date() : doc.lastProcessed
                }
              : doc
          )
        )
        
        // Wait a bit before next update
        if (progress < 100) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
      
      toast.success('Document reprocessed successfully')
      
      // Update vector store counts (if this was a real implementation we'd get updated counts from the backend)
      if (vectorStore) {
        setVectorStore({
          ...vectorStore,
          lastUpdated: new Date()
        })
      }
    } catch (error) {
      console.error('Error reprocessing document:', error)
      toast.error('Failed to reprocess document')
      
      // Mark document as failed
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId ? { ...doc, status: 'failed' as const, progress: undefined } : doc
        )
      )
    }
  }

  return (
    <div className="container py-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Settings</h1>
          {isDirty && (
            <Button onClick={handleSubmit(onSubmit)}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full mb-4">
            <TabsTrigger value="general">
              <Home className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="models">
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Models</span>
            </TabsTrigger>
            <TabsTrigger value="database">
              <Database className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Storage</span>
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Documents</span>
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <Braces className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* General Settings */}
            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Configure basic application settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="appName">Application Name</Label>
                      <Input
                        id="appName"
                        placeholder="Research Assistant"
                        {...register('appName', { required: true })}
                      />
                      {errors.appName && (
                        <p className="text-sm text-red-500">Application name is required</p>
                      )}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <Label htmlFor="documentDirectory">Document Directory</Label>
                    <div className="flex gap-2">
                      <Input
                        id="documentDirectory"
                        placeholder="./documents"
                        {...register('documentDirectory', { required: true })}
                        className="flex-1"
                      />
                      <Button variant="outline" type="button">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Browse
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Directory where your documents are stored
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vectorStoreDirectory">Vector Store Directory</Label>
                    <div className="flex gap-2">
                      <Input
                        id="vectorStoreDirectory"
                        placeholder="./data"
                        {...register('vectorStoreDirectory', { required: true })}
                        className="flex-1"
                      />
                      <Button variant="outline" type="button">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Browse
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Directory where vector databases are stored
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Configure API keys for different model providers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4" />
                        <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                      </div>
                      <Switch checked={openAIEnabled} onCheckedChange={setOpenAIEnabled} />
                    </div>

                    {openAIEnabled && (
                      <div className="ml-6">
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              id="openaiApiKey"
                              type="password"
                              placeholder="sk-..."
                              {...register('openaiApiKey', {
                                required: openAIEnabled
                              })}
                              className="flex-1"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => {
                                      const current = watch('openaiApiKey')
                                      // Toggle between showing the actual key and masked version
                                      if (current.includes('•')) {
                                        setValue('openaiApiKey', 'sk-') // Just show the prefix for user to enter key
                                      } else {
                                        setValue('openaiApiKey', '••••••••••••••••••••••••••••••')
                                      }
                                    }}
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Toggle visibility</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Enter your OpenAI API key to use models like GPT-4 and embeddings
                          </p>
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4" />
                        <Label htmlFor="anthropicApiKey">Anthropic API Key</Label>
                      </div>
                      <Switch checked={anthropicEnabled} onCheckedChange={setAnthropicEnabled} />
                    </div>

                    {anthropicEnabled && (
                      <div className="ml-6">
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              id="anthropicApiKey"
                              type="password"
                              placeholder="sk_ant-..."
                              {...register('anthropicApiKey', {
                                required: anthropicEnabled
                              })}
                              className="flex-1"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => {
                                      const current = watch('anthropicApiKey')
                                      if (current.includes('•')) {
                                        setValue(
                                          'anthropicApiKey',
                                          'sk_ant-' // Just show the prefix for user to enter key
                                        )
                                      } else {
                                        setValue(
                                          'anthropicApiKey',
                                          '••••••••••••••••••••••••••••••'
                                        )
                                      }
                                    }}
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Toggle visibility</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Enter your Anthropic API key to use Claude models
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Model Settings */}
            <TabsContent value="models" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Default Model Settings</CardTitle>
                  <CardDescription>Configure which AI models to use by default</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Default Model Provider</Label>
                      <RadioGroup
                        value={watch('defaultModelProvider')}
                        onValueChange={(value) =>
                          setValue('defaultModelProvider', value, { shouldDirty: true })
                        }
                        className="flex flex-col space-y-2"
                      >
                        {availableModels.map((provider) => (
                          <div
                            key={provider.provider}
                            className={cn(
                              'flex items-center space-x-2 rounded-md border p-3',
                              selectedProvider === provider.provider && 'border-primary',
                              provider.provider === 'openai' && !openAIEnabled && 'opacity-50',
                              provider.provider === 'anthropic' && !anthropicEnabled && 'opacity-50',
                              provider.provider === 'local' && !enableLocalModels && 'opacity-50'
                            )}
                          >
                            <RadioGroupItem
                              value={provider.provider}
                              id={`provider-${provider.provider}`}
                              disabled={
                                (provider.provider === 'openai' && !openAIEnabled) ||
                                (provider.provider === 'anthropic' && !anthropicEnabled) ||
                                (provider.provider === 'local' && !enableLocalModels)
                              }
                            />
                            <Label
                              htmlFor={`provider-${provider.provider}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium">
                                  {provider.provider === 'openai' ? 'OpenAI' : 
                                   provider.provider === 'anthropic' ? 'Anthropic' : 
                                   provider.provider === 'local' ? 'Local Models' : 
                                   provider.provider}
                                </div>
                                {provider.provider === 'openai' && !openAIEnabled && (
                                  <Badge variant="outline">API Key Required</Badge>
                                )}
                                {provider.provider === 'anthropic' && !anthropicEnabled && (
                                  <Badge variant="outline">API Key Required</Badge>
                                )}
                                {provider.provider === 'local' && !enableLocalModels && (
                                  <Badge variant="outline">Disabled</Badge>
                                )}
                              </div>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <Separator className="my-4" />

                    {/* Default model selections for each provider */}
                    <div className="space-y-6">
                      {openAIEnabled && (
                        <div className="space-y-3">
                          <Label htmlFor="defaultOpenAIModel">Default OpenAI Model</Label>
                          <Select
                            value={watch('defaultOpenAIModel')}
                            onValueChange={(value) =>
                              setValue('defaultOpenAIModel', value, { shouldDirty: true })
                            }
                          >
                            <SelectTrigger id="defaultOpenAIModel">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableModels
                                .find(p => p.provider === 'openai')
                                ?.models.map((modelId) => (
                                  <SelectItem key={modelId} value={modelId}>
                                    <div className="flex items-center">
                                      <span>{DEFAULT_MODEL_INFO.openai.models[modelId]?.name || modelId}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <div className="p-3 rounded-md bg-muted">
                            <div className="text-sm">
                              {DEFAULT_MODEL_INFO.openai.models[watch('defaultOpenAIModel')]
                                ?.description || 'No description available'}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2">
                              <Badge variant="outline">
                                Context:{' '}
                                {DEFAULT_MODEL_INFO.openai.models[watch('defaultOpenAIModel')]
                                  ?.contextLength?.toLocaleString() || 'N/A'}{' '}
                                tokens
                              </Badge>
                              {DEFAULT_MODEL_INFO.openai.models[watch('defaultOpenAIModel')]
                                ?.costPer1KTokens && (
                                <Badge variant="outline">
                                  Cost: $
                                  {DEFAULT_MODEL_INFO.openai.models[watch('defaultOpenAIModel')]
                                    ?.costPer1KTokens}
                                  /1K tokens
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {anthropicEnabled && (
                        <div className="space-y-3">
                          <Label htmlFor="defaultAnthropicModel">Default Anthropic Model</Label>
                          <Select
                            value={watch('defaultAnthropicModel')}
                            onValueChange={(value) =>
                              setValue('defaultAnthropicModel', value, { shouldDirty: true })
                            }
                          >
                            <SelectTrigger id="defaultAnthropicModel">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableModels
                                .find(p => p.provider === 'anthropic')
                                ?.models.map((modelId) => (
                                  <SelectItem key={modelId} value={modelId}>
                                    <div className="flex items-center">
                                      <span>{DEFAULT_MODEL_INFO.anthropic.models[modelId]?.name || modelId}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <div className="p-3 rounded-md bg-muted">
                            <div className="text-sm">
                              {DEFAULT_MODEL_INFO.anthropic.models[watch('defaultAnthropicModel')]
                                ?.description || 'No description available'}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2">
                              <Badge variant="outline">
                                Context:{' '}
                                {DEFAULT_MODEL_INFO.anthropic.models[watch('defaultAnthropicModel')]
                                  ?.contextLength?.toLocaleString() || 'N/A'}{' '}
                                tokens
                              </Badge>
                              {DEFAULT_MODEL_INFO.anthropic.models[watch('defaultAnthropicModel')]
                                ?.costPer1KTokens && (
                                <Badge variant="outline">
                                  Cost: $
                                  {DEFAULT_MODEL_INFO.anthropic.models[watch('defaultAnthropicModel')]
                                    ?.costPer1KTokens}
                                  /1K tokens
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {enableLocalModels && (
                        <div className="space-y-3">
                          <Label htmlFor="defaultLocalModel">Default Local Model</Label>
                          <Select
                            value={watch('defaultLocalModel')}
                            onValueChange={(value) =>
                              setValue('defaultLocalModel', value, { shouldDirty: true })
                            }
                          >
                            <SelectTrigger id="defaultLocalModel">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableModels
                                .find((p) => p.provider === 'local')
                                ?.models.map((modelId) => (
                                  <SelectItem key={modelId} value={modelId}>
                                    <div className="flex items-center">
                                      <span>{modelId}</span>
                                    </div>
                                  </SelectItem>
                                )) || [
                                  // Fallback local model options if none available from API
                                  <SelectItem key="llama-3-8b" value="llama-3-8b">
                                    <div className="flex items-center">
                                      <span>Llama 3 (8B)</span>
                                    </div>
                                  </SelectItem>,
                                  <SelectItem key="mistral-7b" value="mistral-7b">
                                    <div className="flex items-center">
                                      <span>Mistral (7B)</span>
                                    </div>
                                  </SelectItem>
                                ]}
                            </SelectContent>
                          </Select>
                          <div className="p-3 rounded-md bg-muted">
                            <div className="text-sm">
                              {watch('defaultLocalModel') === 'llama-3-8b' 
                                ? 'Latest Llama 3 model from Meta, optimized for efficiency and performance at 8B parameters'
                                : watch('defaultLocalModel') === 'mistral-7b'
                                ? 'High quality 7B parameter model with strong reasoning capabilities'
                                : 'Local inference model with no data sharing'}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2">
                              <Badge variant="outline">
                                Context:{' '}
                                {watch('defaultLocalModel') === 'llama-3-8b' 
                                  ? '8K' 
                                  : watch('defaultLocalModel') === 'mistral-7b'
                                  ? '8K'
                                  : '4K'}{' '}
                                tokens
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Embedding Settings</CardTitle>
                  <CardDescription>
                    Configure embedding models for vector search and retrieval
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="embeddingProvider">Embedding Provider</Label>
                    <Select
                      value={watch('embeddingProvider')}
                      onValueChange={(value) =>
                        setValue('embeddingProvider', value, { shouldDirty: true })
                      }
                    >
                      <SelectTrigger id="embeddingProvider">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="local">Local (SentenceTransformers)</SelectItem>
                      </SelectContent>
                    </Select>
                    {watch('embeddingProvider') === 'openai' && !openAIEnabled && (
                      <div className="text-amber-500 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        An OpenAI API key is required for this embedding provider
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="embeddingModel">Embedding Model</Label>
                    <Select
                      value={watch('embeddingModel')}
                      onValueChange={(value) =>
                        setValue('embeddingModel', value, { shouldDirty: true })
                      }
                    >
                      <SelectTrigger id="embeddingModel">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {watch('embeddingProvider') === 'openai' ? (
                          <>
                            <SelectItem value="text-embedding-3-small">
                              text-embedding-3-small
                            </SelectItem>
                            <SelectItem value="text-embedding-3-large">
                              text-embedding-3-large
                            </SelectItem>
                            <SelectItem value="text-embedding-ada-002">
                              text-embedding-ada-002 (Legacy)
                            </SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="all-MiniLM-L6-v2">
                              all-MiniLM-L6-v2 (Fast)
                            </SelectItem>
                            <SelectItem value="all-mpnet-base-v2">
                              all-mpnet-base-v2 (Balanced)
                            </SelectItem>
                            <SelectItem value="bge-large-en-v1.5">
                              bge-large-en-v1.5 (High Quality)
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="chunkSize">Chunk Size (tokens)</Label>
                      <Input
                        id="chunkSize"
                        type="number"
                        min={100}
                        max={8000}
                        {...register('chunkSize', {
                          required: true,
                          valueAsNumber: true,
                          min: 100,
                          max: 8000
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Size of text chunks for embedding (recommended: 1000-2000)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chunkOverlap">Chunk Overlap (tokens)</Label>
                      <Input
                        id="chunkOverlap"
                        type="number"
                        min={0}
                        max={1000}
                        {...register('chunkOverlap', {
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                          max: 1000
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Overlap between consecutive chunks (recommended: 10-20% of chunk size)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Database Settings */}
            <TabsContent value="database" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vector Stores</CardTitle>
                  <CardDescription>Manage your ChromaDB and SQLite vector stores</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {vectorStore ? (
                      <Card className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center">
                                <h3 className="font-medium">{vectorStore.name}</h3>
                                <Badge variant="outline" className="ml-2">
                                  ChromaDB
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {vectorStore.location}
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm">
                                <span className="flex items-center">
                                  <Database className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                  {vectorStore.embeddings.toLocaleString()} embeddings
                                </span>
                                <span className="flex items-center">
                                  <FileText className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                  {vectorStore.documents.toLocaleString()} documents
                                </span>
                                <span className="flex items-center">
                                  <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                  Last updated:{' '}
                                  {new Date(vectorStore.lastUpdated).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isReindexing}
                                onClick={refreshVectorStore}
                              >
                                {isReindexing ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Refreshing...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : isLoadingDocuments ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                      </div>
                    ) : (
                      <div className="text-center p-6">
                        <p className="text-muted-foreground">
                          No vector stores found. Upload documents to create embeddings.
                        </p>
                      </div>
                    )}
                  </div>

                  <Dialog open={deleteStoreDialogOpen} onOpenChange={setDeleteStoreDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Vector Store</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete this vector store? This action cannot be
                          undone and all embeddings will be permanently deleted.
                        </DialogDescription>
                      </DialogHeader>
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                          Deleting this vector store will require re-uploading and re-embedding all
                          documents associated with it.
                        </AlertDescription>
                      </Alert>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteStoreDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteStore}>
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>Storage Configuration</CardTitle>
                    <CardDescription>
                      Configure ChromaDB and SQLite storage settings
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="similarityThreshold">Similarity Threshold</Label>
                      <Input
                        id="similarityThreshold"
                        type="number"
                        step="0.01"
                        min={0}
                        max={1}
                        {...register('similarityThreshold', {
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                          max: 1
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum similarity score for retrieved documents (0-1)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxSourcesPerResponse">Max Sources Per Response</Label>
                      <Input
                        id="maxSourcesPerResponse"
                        type="number"
                        min={1}
                        max={20}
                        {...register('maxSourcesPerResponse', {
                          required: true,
                          valueAsNumber: true,
                          min: 1,
                          max: 20
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum number of document sources to include in each response
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enableCaching"
                        checked={watch('enableCaching')}
                        onCheckedChange={(checked) =>
                          setValue('enableCaching', checked as boolean, { shouldDirty: true })
                        }
                      />
                      <Label htmlFor="enableCaching">Enable Query Caching</Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Cache query results to improve performance for repeated questions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Document Library</CardTitle>
                  <CardDescription>Manage and view all indexed documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {isLoadingDocuments ? (
                        <div className="flex items-center justify-center p-8">
                          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                        </div>
                      ) : documents.length === 0 ? (
                        <div className="text-center p-6">
                          <p className="text-muted-foreground">
                            No documents found. Go to the upload page to add documents.
                          </p>
                        </div>
                      ) : (
                        documents.map((doc) => (
                          <div key={doc.id} className="border rounded-md overflow-hidden">
                            <div className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center">
                                    <h3 className="font-medium">{doc.title}</h3>
                                    <Badge
                                      className="ml-2"
                                      variant={
                                        doc.status === 'processed'
                                          ? 'default'
                                          : doc.status === 'processing'
                                            ? 'secondary'
                                            : doc.status === 'failed'
                                              ? 'destructive'
                                              : 'outline'
                                      }
                                    >
                                      {doc.status === 'processed'
                                        ? 'Processed'
                                        : doc.status === 'processing'
                                          ? 'Processing'
                                          : doc.status === 'failed'
                                            ? 'Failed'
                                            : 'Queued'}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                                    <span>{doc.type}</span>
                                    <span>{(doc.path.length / 1024).toFixed(1)} KB (approx)</span>
                                    {doc.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {doc.tags.map((tag) => (
                                          <Badge key={tag} variant="outline" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deleteDocument(doc.id)}
                                    disabled={doc.status === 'processing'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {doc.status === 'processed' && doc.lastProcessed && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Last updated: {new Date(doc.lastProcessed).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Document Processing</CardTitle>
                  <CardDescription>
                    Configure how documents are processed and chunked
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="chunkSize">Default Chunk Size</Label>
                      <Input
                        id="chunkSize"
                        type="number"
                        min={100}
                        max={8000}
                        {...register('chunkSize', {
                          required: true,
                          valueAsNumber: true,
                          min: 100,
                          max: 8000
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Size of text chunks for embedding (recommended: 1000-2000)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chunkOverlap">Default Chunk Overlap</Label>
                      <Input
                        id="chunkOverlap"
                        type="number"
                        min={0}
                        max={1000}
                        {...register('chunkOverlap', {
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                          max: 1000
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Overlap between consecutive chunks
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Configuration</CardTitle>
                  <CardDescription>
                    Configure advanced settings for LangChain and API requests
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="maxTokensPerRequest">Max Tokens Per Request</Label>
                      <Input
                        id="maxTokensPerRequest"
                        type="number"
                        min={100}
                        max={16000}
                        {...register('maxTokensPerRequest', {
                          required: true,
                          valueAsNumber: true,
                          min: 100,
                          max: 16000
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum tokens for each model request (affects response length)
                      </p>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="temperatureDefault">Default Temperature</Label>
                      <Input
                        id="temperatureDefault"
                        type="number"
                        step="0.1"
                        min={0}
                        max={2}
                        {...register('temperatureDefault', {
                          required: true,
                          valueAsNumber: true,
                          min: 0,
                          max: 2
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Controls randomness in responses (0 = deterministic, 1 = creative)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="useStream"
                          checked={watch('useStream')}
                          onCheckedChange={(checked) =>
                            setValue('useStream', checked as boolean, { shouldDirty: true })
                          }
                        />
                        <Label htmlFor="useStream">Enable Streaming Responses</Label>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Display responses as they are generated rather than waiting for completion
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="webSearchEnabled"
                          checked={watch('webSearchEnabled')}
                          onCheckedChange={(checked) =>
                            setValue('webSearchEnabled', checked as boolean, { shouldDirty: true })
                          }
                        />
                        <Label htmlFor="webSearchEnabled">Enable Web Search</Label>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Allow retrieval-augmented generation to include web search results when
                        needed
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <Collapsible
                    open={advancedSettingsOpen}
                    onOpenChange={setAdvancedSettingsOpen}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Local Model Settings</h4>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {advancedSettingsOpen ? 'Hide' : 'Show'}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="enableLocalModels"
                            checked={watch('enableLocalModels')}
                            onCheckedChange={(checked) => {
                              setValue('enableLocalModels', checked as boolean, {
                                shouldDirty: true
                              })
                              setLocalModelsEnabled(checked as boolean)
                            }}
                          />
                          <Label htmlFor="enableLocalModels">Enable Local Models</Label>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                          Use locally installed models (requires additional configuration)
                        </p>
                      </div>

                      {watch('enableLocalModels') && (
                        <>
                          <Alert>
                            <Cpu className="h-4 w-4" />
                            <AlertTitle>Local Model Requirements</AlertTitle>
                            <AlertDescription>
                              Local models require sufficient hardware resources. Make sure you have
                              adequate GPU memory and disk space available.
                            </AlertDescription>
                          </Alert>

                          <div className="space-y-2">
                            <Label htmlFor="localModelPath">Local Model Path</Label>
                            <div className="flex gap-2">
                              <Input
                                id="localModelPath"
                                placeholder="./models"
                                {...register('localModelPath', {
                                  required: watch('enableLocalModels')
                                })}
                                className="flex-1"
                              />
                              <Button variant="outline" type="button">
                                <FolderOpen className="h-4 w-4 mr-2" />
                                Browse
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Directory where local models are installed
                            </p>
                          </div>
                        </>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" type="button" onClick={() => reset()}>
                    Reset to Defaults
                  </Button>
                  {isDirty && (
                    <Button onClick={handleSubmit(onSubmit)}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
          </form>
        </Tabs>
      </motion.div>
    </div>
  )
}

export default SettingsPage
