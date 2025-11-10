import { FormEvent, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { apiClient, type User } from '@/lib/api'

type UserPreferences = {
  theme: 'light' | 'dark' | 'system'
  auto_send: boolean
  show_sources: boolean
  default_chat_model: string
  use_personal_api_key: boolean
}

type UserSettingsResponse = {
  preferences: UserPreferences
  personal_api_key_set: boolean
}

type AdminSettings = {
  embeddings: Record<string, any>
  chat: Record<string, any>
  vectorstore: Record<string, any>
}

type GlobalKeyInfo = {
  has_override: boolean
  source: 'env' | 'admin'
  updated_at?: string | null
  updated_by?: number | null
}

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  const [prefForm, setPrefForm] = useState<UserPreferences | null>(null)
  const [personalKeyInput, setPersonalKeyInput] = useState('')
  const [adminForm, setAdminForm] = useState<AdminSettings | null>(null)
  const [globalKeyInput, setGlobalKeyInput] = useState('')
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    is_active: true,
  })

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiClient.getCurrentUser(),
  })
  const isAdmin = currentUser?.role === 'admin'

  const { data: userSettings, isLoading: loadingUserSettings } = useQuery<UserSettingsResponse>({
    queryKey: ['user-settings'],
    queryFn: () => apiClient.getUserSettings(),
  })

  useEffect(() => {
    if (userSettings) {
      setPrefForm(userSettings.preferences)
    }
  }, [userSettings])

  const { data: adminSettings, isLoading: loadingAdminSettings } = useQuery<AdminSettings>({
    queryKey: ['admin-settings'],
    queryFn: () => apiClient.getSettings(),
    enabled: isAdmin,
  })

  useEffect(() => {
    if (adminSettings) {
      setAdminForm(adminSettings)
    }
  }, [adminSettings])

  const { data: globalKeyInfo } = useQuery<GlobalKeyInfo>({
    queryKey: ['global-openai-key'],
    queryFn: () => apiClient.getGlobalApiKeyInfo(),
    enabled: isAdmin,
  })

  const { data: users, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.getUsers(),
    enabled: isAdmin,
  })

  const updatePreferencesMutation = useMutation({
    mutationFn: (payload: UserPreferences) => apiClient.updateUserPreferences(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-settings'] }),
  })

  const personalKeyMutation = useMutation({
    mutationFn: (apiKey: string) => apiClient.setPersonalApiKey(apiKey),
    onSuccess: () => {
      setPersonalKeyInput('')
      queryClient.invalidateQueries({ queryKey: ['user-settings'] })
    },
  })

  const deletePersonalKeyMutation = useMutation({
    mutationFn: () => apiClient.deletePersonalApiKey(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-settings'] }),
  })

  const updateAdminSettingsMutation = useMutation({
    mutationFn: (payload: AdminSettings) => apiClient.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })

  const resetSettingsMutation = useMutation({
    mutationFn: () => apiClient.resetSettings(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-settings'] }),
  })

  const setGlobalKeyMutation = useMutation({
    mutationFn: (apiKey: string) => apiClient.setGlobalApiKey(apiKey),
    onSuccess: () => {
      setGlobalKeyInput('')
      queryClient.invalidateQueries({ queryKey: ['global-openai-key'] })
    },
  })

  const clearGlobalKeyMutation = useMutation({
    mutationFn: () => apiClient.clearGlobalApiKey(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['global-openai-key'] }),
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: Record<string, unknown> }) =>
      apiClient.updateUser(userId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => apiClient.deleteUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const createUserMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiClient.createUser(payload),
    onSuccess: () => {
      setNewUserForm({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        is_active: true,
      })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const canUsePersonalKey = userSettings?.personal_api_key_set ?? false

  const themeOptions = [
    { label: 'System', value: 'system' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ]

  const chatModelOptions = [
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  ]

  const handlePrefSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!prefForm) return
    updatePreferencesMutation.mutate(prefForm)
  }

  const handleAdminSettingsSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!adminForm) return
    updateAdminSettingsMutation.mutate(adminForm)
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Control your personal preferences and (if available) workspace-level configuration.</p>
        </div>

        {/* Personal Preferences */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Personal preferences</h2>
            <p className="text-sm text-gray-500">These settings only apply to your account.</p>
          </div>

          {loadingUserSettings || !prefForm ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="h-12 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <form onSubmit={handlePrefSubmit} className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700">Theme</label>
                <div className="mt-2 flex gap-3">
                  {themeOptions.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded border px-3 py-2">
                      <input
                        type="radio"
                        name="theme"
                        value={option.value}
                        checked={prefForm.theme === option.value}
                        onChange={(e) =>
                          setPrefForm((prev) => prev ? { ...prev, theme: e.target.value as UserPreferences['theme'] } : prev)
                        }
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <PreferenceToggle
                  label="Auto-send messages"
                  description="Automatically send messages when pressing Enter."
                  checked={prefForm.auto_send}
                  onChange={(checked) =>
                    setPrefForm((prev) => prev ? { ...prev, auto_send: checked } : prev)
                  }
                />
                <PreferenceToggle
                  label="Always show sources"
                  description="Expand source citations by default after each answer."
                  checked={prefForm.show_sources}
                  onChange={(checked) =>
                    setPrefForm((prev) => prev ? { ...prev, show_sources: checked } : prev)
                  }
                />
                <PreferenceToggle
                  label="Use personal API key"
                  description={canUsePersonalKey ? 'Run chats with your own API quota.' : 'Add a personal API key to use this option.'}
                  checked={prefForm.use_personal_api_key && canUsePersonalKey}
                  disabled={!canUsePersonalKey}
                  onChange={(checked) =>
                    setPrefForm((prev) => prev ? { ...prev, use_personal_api_key: checked } : prev)
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Default chat model</label>
                <select
                  value={prefForm.default_chat_model}
                  onChange={(e) =>
                    setPrefForm((prev) => prev ? { ...prev, default_chat_model: e.target.value } : prev)
                  }
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {chatModelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                  disabled={updatePreferencesMutation.isPending}
                >
                  {updatePreferencesMutation.isPending ? 'Saving...' : 'Save preferences'}
                </button>
                {updatePreferencesMutation.isSuccess && (
                  <span className="text-sm text-green-600">Saved!</span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Personal API key */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Personal API key</h2>
              <p className="text-sm text-gray-500">
                Use your own OpenAI key for chat sessions. This never replaces the workspace-wide key.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                userSettings?.personal_api_key_set ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {userSettings?.personal_api_key_set ? 'Active' : 'Not set'}
            </span>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (personalKeyInput.trim()) {
                personalKeyMutation.mutate(personalKeyInput.trim())
              }
            }}
          >
            <label className="text-sm font-medium text-gray-700">OpenAI API key</label>
            <input
              type="password"
              value={personalKeyInput}
              onChange={(e) => setPersonalKeyInput(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={!personalKeyInput || personalKeyMutation.isPending}
              >
                {personalKeyMutation.isPending ? 'Saving...' : 'Save key'}
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={!userSettings?.personal_api_key_set || deletePersonalKeyMutation.isPending}
                onClick={() => deletePersonalKeyMutation.mutate()}
              >
                Remove key
              </button>
            </div>
          </form>
        </div>

        {isAdmin && (
          <>
            {/* Admin Settings */}
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Admin workspace settings</h2>
                  <p className="text-sm text-gray-500">Applies to all users in this deployment.</p>
                </div>
                <button
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                  disabled={resetSettingsMutation.isPending}
                  onClick={() => resetSettingsMutation.mutate()}
                >
                  Reset to defaults
                </button>
              </div>

              {loadingAdminSettings || !adminForm ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, idx) => (
                    <div key={idx} className="h-12 animate-pulse rounded bg-gray-100" />
                  ))}
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleAdminSettingsSubmit}>
                  <fieldset className="rounded border border-gray-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-gray-700">Embeddings</legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField
                        label="Model"
                        value={adminForm.embeddings.model || ''}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, embeddings: { ...prev.embeddings, model: value } } : prev
                          )
                        }
                      />
                      <NumberField
                        label="Chunk size"
                        value={adminForm.embeddings.chunk_size || 0}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, embeddings: { ...prev.embeddings, chunk_size: value } } : prev
                          )
                        }
                      />
                      <NumberField
                        label="Chunk overlap"
                        value={adminForm.embeddings.chunk_overlap || 0}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, embeddings: { ...prev.embeddings, chunk_overlap: value } } : prev
                          )
                        }
                      />
                      <NumberField
                        label="Batch size"
                        value={adminForm.embeddings.batch_size || 0}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, embeddings: { ...prev.embeddings, batch_size: value } } : prev
                          )
                        }
                      />
                      <NumberField
                        label="Per-second rate limit"
                        value={adminForm.embeddings.rate_limit || 0}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, embeddings: { ...prev.embeddings, rate_limit: value } } : prev
                          )
                        }
                      />
                    </div>
                  </fieldset>

                  <fieldset className="rounded border border-gray-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-gray-700">Chat</legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField
                        label="Model"
                        value={adminForm.chat.model || ''}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, chat: { ...prev.chat, model: value } } : prev
                          )
                        }
                      />
                      <NumberField
                        label="Temperature"
                        step="0.1"
                        value={adminForm.chat.temperature || 0}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, chat: { ...prev.chat, temperature: value } } : prev
                          )
                        }
                      />
                      <PreferenceToggle
                        label="Streaming responses"
                        description="Enable server-sent events for faster responses."
                        checked={Boolean(adminForm.chat.streaming)}
                        onChange={(checked) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, chat: { ...prev.chat, streaming: checked } } : prev
                          )
                        }
                      />
                    </div>
                  </fieldset>

                  <fieldset className="rounded border border-gray-200 p-4">
                    <legend className="px-2 text-sm font-semibold text-gray-700">Vector search</legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="Top K"
                        value={adminForm.vectorstore.k || 0}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, vectorstore: { ...prev.vectorstore, k: value } } : prev
                          )
                        }
                      />
                      <NumberField
                        label="Fetch K (MMR)"
                        value={adminForm.vectorstore.fetch_k || 0}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, vectorstore: { ...prev.vectorstore, fetch_k: value } } : prev
                          )
                        }
                      />
                      <InputField
                        label="Search type"
                        value={adminForm.vectorstore.search_type || ''}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev ? { ...prev, vectorstore: { ...prev.vectorstore, search_type: value } } : prev
                          )
                        }
                      />
                    </div>
                  </fieldset>

                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={updateAdminSettingsMutation.isPending}
                  >
                    {updateAdminSettingsMutation.isPending ? 'Saving...' : 'Save admin settings'}
                  </button>
                </form>
              )}
            </div>

            {/* Global API Key */}
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Workspace API key</h2>
                  <p className="text-sm text-gray-500">Override the default OpenAI key from deployment environment variables.</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    globalKeyInfo?.has_override ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {globalKeyInfo?.has_override ? 'Admin override active' : 'Using .env key'}
                </span>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (globalKeyInput.trim()) {
                    setGlobalKeyMutation.mutate(globalKeyInput.trim())
                  }
                }}
              >
                <label className="text-sm font-medium text-gray-700">Override key</label>
                <input
                  type="password"
                  value={globalKeyInput}
                  onChange={(e) => setGlobalKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={!globalKeyInput || setGlobalKeyMutation.isPending}
                  >
                    {setGlobalKeyMutation.isPending ? 'Saving...' : 'Save override'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    disabled={!globalKeyInfo?.has_override || clearGlobalKeyMutation.isPending}
                    onClick={() => clearGlobalKeyMutation.mutate()}
                  >
                    Revert to .env key
                  </button>
                </div>
              </form>
            </div>

            {/* User Management */}
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">User management</h2>
                  <p className="text-sm text-gray-500">Grant access, promote admins, or deactivate accounts.</p>
                </div>
              </div>

              {loadingUsers ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, idx) => (
                    <div key={idx} className="h-10 animate-pulse rounded bg-gray-100" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">User</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Role</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {users?.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{user.email}</p>
                            <p className="text-xs text-gray-500">{user.full_name || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={user.role}
                              onChange={(e) =>
                                updateUserMutation.mutate({
                                  userId: user.id,
                                  data: { role: e.target.value },
                                })
                              }
                              className="rounded border border-gray-300 px-2 py-1 text-sm"
                              disabled={user.id === currentUser?.id}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <PreferenceToggle
                              label={user.is_active ? 'Active' : 'Inactive'}
                              hideDescription
                              checked={user.is_active}
                              disabled={user.id === currentUser?.id}
                              onChange={(checked) =>
                                updateUserMutation.mutate({
                                  userId: user.id,
                                  data: { is_active: checked },
                                })
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                              disabled={user.id === currentUser?.id}
                              onClick={() => {
                                if (confirm(`Remove ${user.email}?`)) {
                                  deleteUserMutation.mutate(user.id)
                                }
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700">Invite user</h3>
                <form
                  className="mt-3 grid gap-4 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    createUserMutation.mutate({
                      email: newUserForm.email,
                      password: newUserForm.password,
                      full_name: newUserForm.full_name || undefined,
                      role: newUserForm.role,
                      is_active: newUserForm.is_active,
                    })
                  }}
                >
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Temporary password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Full name (optional)"
                    value={newUserForm.full_name}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value }))}
                    className="rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <PreferenceToggle
                    label="Active immediately"
                    hideDescription
                    checked={newUserForm.is_active}
                    onChange={(checked) =>
                      setNewUserForm((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? 'Creating...' : 'Create user'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PreferenceToggle({
  label,
  description,
  hideDescription,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  hideDescription?: boolean
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`flex cursor-pointer flex-col rounded border px-3 py-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      </div>
      {!hideDescription && description && (
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      )}
    </label>
  )
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
  step = '1',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      {label}
      <input
        type="number"
        value={Number(value)}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  )
}
