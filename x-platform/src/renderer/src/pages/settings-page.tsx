import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Save,
  Database,
  Key,
  Home,
  FolderOpen,
  Globe,
  Braces,
  FileText,
  AlertCircle,
  Sparkles,
  Cpu
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSettingsContext } from '@/contexts'

// Default model information - will be replaced with data from the API
const DEFAULT_MODEL_INFO = {
  openai: {
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
  anthropic: {
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

const DEFAULT_AVAILABLE_MODELS = [
  {
    provider: 'openai',
    models: ['gpt-4o', 'gpt-3.5-turbo', 'gpt-4o-mini']
  },
  {
    provider: 'anthropic',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  {
    provider: 'local',
    models: ['llama-3-8b', 'mistral-7b']
  }
]

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

  // Use settings context
  const { settings, updateSettings, setApiKey } = useSettingsContext()

  // Additional local UI states can remain
  const [openAIEnabled, setOpenAIEnabled] = useState(settings.defaultModel.provider === 'openai')
  const [anthropicEnabled, setAnthropicEnabled] = useState(
    settings.defaultModel.provider === 'anthropic'
  )
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false)
  const [availableModels, _setAvailableModels] = useState(DEFAULT_AVAILABLE_MODELS)
  const [_localModelsEnabled, setLocalModelsEnabled] = useState(false)

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

      defaultModelProvider: 'openai',
      defaultOpenAIModel: 'gpt-4o-mini',
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

  // Handle form submission
  const onSubmit = async (data: SettingsFormValues) => {
    try {
      // Handle API key updates
      if (openAIEnabled && data.openaiApiKey && !data.openaiApiKey.includes('•')) {
        await setApiKey('openai', data.openaiApiKey)
      }

      if (anthropicEnabled && data.anthropicApiKey && !data.anthropicApiKey.includes('•')) {
        await setApiKey('anthropic', data.anthropicApiKey)
      }

      // Update settings in the store
      await updateSettings({
        defaultModel: {
          provider: data.defaultModelProvider as 'openai' | 'anthropic',
          model:
            data.defaultModelProvider === 'openai'
              ? data.defaultOpenAIModel
              : data.defaultAnthropicModel,
          temperature: data.temperatureDefault,
          maxTokens: data.maxTokensPerRequest
        },
        embeddingModel: {
          provider: data.embeddingProvider as 'openai' | 'huggingface',
          model: data.embeddingModel
        },
        ragConfig: {
          chunkSize: data.chunkSize,
          chunkOverlap: data.chunkOverlap,
          similarityThreshold: data.similarityThreshold,
          maxSources: data.maxSourcesPerResponse
        }
      })

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
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
                              provider.provider === 'anthropic' &&
                                !anthropicEnabled &&
                                'opacity-50',
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
                                  {provider.provider === 'openai'
                                    ? 'OpenAI'
                                    : provider.provider === 'anthropic'
                                      ? 'Anthropic'
                                      : provider.provider === 'local'
                                        ? 'Local Models'
                                        : provider.provider}
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
                                .find((p) => p.provider === 'openai')
                                ?.models.map((modelId) => (
                                  <SelectItem key={modelId} value={modelId}>
                                    <div className="flex items-center">
                                      <span>
                                        {DEFAULT_MODEL_INFO.openai.models[modelId]?.name || modelId}
                                      </span>
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
                                {DEFAULT_MODEL_INFO.openai.models[
                                  watch('defaultOpenAIModel')
                                ]?.contextLength?.toLocaleString() || 'N/A'}{' '}
                                tokens
                              </Badge>
                              {DEFAULT_MODEL_INFO.openai.models[watch('defaultOpenAIModel')]
                                ?.costPer1KTokens && (
                                <Badge variant="outline">
                                  Cost: $
                                  {
                                    DEFAULT_MODEL_INFO.openai.models[watch('defaultOpenAIModel')]
                                      ?.costPer1KTokens
                                  }
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
                                .find((p) => p.provider === 'anthropic')
                                ?.models.map((modelId) => (
                                  <SelectItem key={modelId} value={modelId}>
                                    <div className="flex items-center">
                                      <span>
                                        {DEFAULT_MODEL_INFO.anthropic.models[modelId]?.name ||
                                          modelId}
                                      </span>
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
                                {DEFAULT_MODEL_INFO.anthropic.models[
                                  watch('defaultAnthropicModel')
                                ]?.contextLength?.toLocaleString() || 'N/A'}{' '}
                                tokens
                              </Badge>
                              {DEFAULT_MODEL_INFO.anthropic.models[watch('defaultAnthropicModel')]
                                ?.costPer1KTokens && (
                                <Badge variant="outline">
                                  Cost: $
                                  {
                                    DEFAULT_MODEL_INFO.anthropic.models[
                                      watch('defaultAnthropicModel')
                                    ]?.costPer1KTokens
                                  }
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
