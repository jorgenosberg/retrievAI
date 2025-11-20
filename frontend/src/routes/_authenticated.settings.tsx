import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { apiClient, type User } from "@/lib/api";
import {
  DEFAULT_USER_PREFERENCES,
  clearStoredPreferences,
  getPreferencesUpdatedAt,
  getStoredPreferences,
  setStoredPreferences,
} from "@/lib/preferencesStorage";
import { getChatCacheStats, clearChatSessions } from "@/lib/chatStorage";
import { getItem, removeItem } from "@/lib/storage";
import { QUERY_CACHE_STORAGE_KEY } from "@/lib/cacheKeys";
import { useThemePreference } from "@/providers/ThemeProvider";
import type { UserPreferences } from "@/types/preferences";

type UserSettingsResponse = {
  preferences: UserPreferences;
  personal_api_key_set: boolean;
};

type AdminSettings = {
  embeddings: Record<string, any>;
  chat: Record<string, any>;
  vectorstore: Record<string, any>;
};

type GlobalKeyInfo = {
  has_override: boolean;
  source: "env" | "admin";
  updated_at?: string | null;
  updated_by?: number | null;
};

type CacheSnapshot = {
  querySizeBytes: number;
  queryLastUpdated: number;
  chatSessions: number;
  chatMessages: number;
  chatLastUpdated: number;
  preferencesLastUpdated: number;
};

const getByteLength = (value: string) => {
  if (typeof Blob !== "undefined") {
    try {
      return new Blob([value]).size;
    } catch {
      return value.length;
    }
  }
  return value.length;
};

const createCacheSnapshot = (): CacheSnapshot => {
  const queryRaw = getItem(QUERY_CACHE_STORAGE_KEY);
  let querySizeBytes = 0;
  let queryLastUpdated = 0;

  if (queryRaw) {
    querySizeBytes = getByteLength(queryRaw);
    try {
      const parsed = JSON.parse(queryRaw) as { timestamp?: number };
      queryLastUpdated = parsed?.timestamp ?? 0;
    } catch {
      queryLastUpdated = 0;
    }
  }

  const chatStats = getChatCacheStats();

  return {
    querySizeBytes,
    queryLastUpdated,
    chatSessions: chatStats.sessionCount,
    chatMessages: chatStats.messageCount,
    chatLastUpdated: chatStats.lastUpdated,
    preferencesLastUpdated: getPreferencesUpdatedAt(),
  };
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`;
};

const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleString();
};

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { setThemePreference } = useThemePreference();
  const [prefForm, setPrefForm] = useState<UserPreferences>(
    () => getStoredPreferences() ?? DEFAULT_USER_PREFERENCES
  );
  const [personalKeyInput, setPersonalKeyInput] = useState("");
  const [adminForm, setAdminForm] = useState<AdminSettings | null>(null);
  const [globalKeyInput, setGlobalKeyInput] = useState("");
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "user",
    is_active: true,
  });
  const [cacheSnapshot, setCacheSnapshot] = useState<CacheSnapshot>(() =>
    createCacheSnapshot()
  );
  const [activeTab, setActiveTab] = useState<
    "personal" | "workspace" | "users" | "storage"
  >("personal");
  const [showEmbeddingWarning, setShowEmbeddingWarning] = useState(false);
  const [pendingEmbeddingModel, setPendingEmbeddingModel] = useState<
    string | null
  >(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => apiClient.getCurrentUser(),
  });
  const isAdmin = currentUser?.role === "admin";

  const { data: userSettings, isLoading: loadingUserSettings } =
    useQuery<UserSettingsResponse>({
      queryKey: ["user-settings"],
      queryFn: () => apiClient.getUserSettings(),
    });

  // Track unsaved changes for personal preferences
  const hasUnsavedChanges = useMemo(() => {
    if (!userSettings?.preferences) return false;
    return (
      JSON.stringify(prefForm) !== JSON.stringify(userSettings.preferences)
    );
  }, [prefForm, userSettings]);

  useEffect(() => {
    if (userSettings?.preferences) {
      setPrefForm(userSettings.preferences);
      setStoredPreferences(userSettings.preferences);
    }
  }, [userSettings]);

  const { data: adminSettings, isLoading: loadingAdminSettings } =
    useQuery<AdminSettings>({
      queryKey: ["admin-settings"],
      queryFn: () => apiClient.getSettings(),
      enabled: isAdmin,
    });

  useEffect(() => {
    if (adminSettings) {
      setAdminForm(adminSettings);
    }
  }, [adminSettings]);

  // Track unsaved changes for admin settings (must be after adminSettings query)
  const hasUnsavedAdminChanges = useMemo(() => {
    if (!adminSettings || !adminForm) return false;
    return JSON.stringify(adminForm) !== JSON.stringify(adminSettings);
  }, [adminForm, adminSettings]);

  const { data: globalKeyInfo } = useQuery<GlobalKeyInfo>({
    queryKey: ["global-openai-key"],
    queryFn: () => apiClient.getGlobalApiKeyInfo(),
    enabled: isAdmin,
  });

  const { data: users, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.getUsers(),
    enabled: isAdmin,
  });

  useEffect(() => {
    setCacheSnapshot(createCacheSnapshot());
  }, []);

  const updatePreferencesMutation = useMutation({
    mutationFn: (payload: UserPreferences) =>
      apiClient.updateUserPreferences(payload),
    onSuccess: (_, variables) => {
      // Apply theme changes after successful save
      setThemePreference(variables.theme);
      setStoredPreferences(variables);
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  const personalKeyMutation = useMutation({
    mutationFn: (apiKey: string) => apiClient.setPersonalApiKey(apiKey),
    onSuccess: () => {
      setPersonalKeyInput("");
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  const deletePersonalKeyMutation = useMutation({
    mutationFn: () => apiClient.deletePersonalApiKey(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["user-settings"] }),
  });

  const updateAdminSettingsMutation = useMutation({
    mutationFn: (payload: AdminSettings) => apiClient.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const resetSettingsMutation = useMutation({
    mutationFn: () => apiClient.resetSettings(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
  });

  const setGlobalKeyMutation = useMutation({
    mutationFn: (apiKey: string) => apiClient.setGlobalApiKey(apiKey),
    onSuccess: () => {
      setGlobalKeyInput("");
      queryClient.invalidateQueries({ queryKey: ["global-openai-key"] });
    },
  });

  const clearGlobalKeyMutation = useMutation({
    mutationFn: () => apiClient.clearGlobalApiKey(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["global-openai-key"] }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: number;
      data: Record<string, unknown>;
    }) => apiClient.updateUser(userId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => apiClient.deleteUser(userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const createUserMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient.createUser(payload),
    onSuccess: () => {
      setNewUserForm({
        email: "",
        password: "",
        full_name: "",
        role: "user",
        is_active: true,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const refreshCacheSnapshot = () => setCacheSnapshot(createCacheSnapshot());

  const handleClearQueryCache = () => {
    queryClient.clear();
    removeItem(QUERY_CACHE_STORAGE_KEY);
    refreshCacheSnapshot();
  };

  const handleClearChatCache = () => {
    clearChatSessions();
    refreshCacheSnapshot();
  };

  const handleClearPreferencesCache = () => {
    clearStoredPreferences();
    setPrefForm({ ...DEFAULT_USER_PREFERENCES });
    setThemePreference(DEFAULT_USER_PREFERENCES.theme);
    refreshCacheSnapshot();
  };

  const handleClearAllLocalData = () => {
    handleClearQueryCache();
    handleClearChatCache();
    handleClearPreferencesCache();
  };

  const canUsePersonalKey = userSettings?.personal_api_key_set ?? false;

  const themeOptions = [
    { label: "System", value: "system" },
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
  ];

  const chatModelOptions = [
    { label: "GPT-5", value: "gpt-5" },
    { label: "GPT-5 Mini", value: "gpt-5-mini" },
    { label: "GPT-5 Nano", value: "gpt-5-nano" },
    { label: "GPT-4.1", value: "gpt-4.1" },
    { label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
    { label: "GPT-4.1 Nano", value: "gpt-4.1-nano" },
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-4o Mini", value: "gpt-4o-mini" },
  ];

  const embeddingModelOptions = [
    {
      label: "Text Embedding 3 Small (1536 dims)",
      value: "text-embedding-3-small",
      description: "High performance, low cost",
    },
    {
      label: "Text Embedding 3 Large (3072 dims)",
      value: "text-embedding-3-large",
      description: "Best performance, higher cost",
    },
    {
      label: "Ada 002 - Legacy (1536 dims)",
      value: "text-embedding-ada-002",
      description: "Previous generation model",
    },
  ];

  const searchTypeOptions = [
    {
      label: "Similarity",
      value: "similarity",
      description: "Standard cosine similarity search",
    },
    {
      label: "MMR (Maximal Marginal Relevance)",
      value: "mmr",
      description: "Balances relevance with diversity",
    },
    {
      label: "Similarity Score Threshold",
      value: "similarity_score_threshold",
      description: "Only results above a threshold",
    },
  ];

  const handlePrefSubmit = (event: FormEvent) => {
    event.preventDefault();
    updatePreferencesMutation.mutate(prefForm);
  };

  const handleAdminSettingsSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!adminForm) return;
    updateAdminSettingsMutation.mutate(adminForm);
  };

  const handleEmbeddingModelChange = (newModel: string) => {
    const currentModel =
      adminForm?.embeddings?.model || adminSettings?.embeddings?.model;

    // If changing from existing model, show warning
    if (currentModel && currentModel !== newModel) {
      setPendingEmbeddingModel(newModel);
      setShowEmbeddingWarning(true);
    } else {
      // No previous model or same model, allow change directly
      setAdminForm((prev) =>
        prev
          ? {
              ...prev,
              embeddings: {
                ...prev.embeddings,
                model: newModel,
              },
            }
          : prev
      );
    }
  };

  const confirmEmbeddingModelChange = () => {
    if (pendingEmbeddingModel) {
      setAdminForm((prev) =>
        prev
          ? {
              ...prev,
              embeddings: {
                ...prev.embeddings,
                model: pendingEmbeddingModel,
              },
            }
          : prev
      );
    }
    setShowEmbeddingWarning(false);
    setPendingEmbeddingModel(null);
  };

  const cancelEmbeddingModelChange = () => {
    setShowEmbeddingWarning(false);
    setPendingEmbeddingModel(null);
  };

  const tabs = [
    { id: "personal" as const, label: "Personal" },
    ...(isAdmin
      ? [
          { id: "workspace" as const, label: "Workspace" },
          { id: "users" as const, label: "Users" },
        ]
      : []),
    { id: "storage" as const, label: "Storage" },
  ];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
            Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
            Manage your preferences, API keys, and{" "}
            {isAdmin ? "workspace configuration" : "local storage"}.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-zinc-800">
          <nav
            className="flex gap-1 -mb-px overflow-x-auto"
            aria-label="Settings tabs"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600 dark:border-primary-500 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "personal" && (
          <>
            {/* Personal Preferences */}
            <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
                  Personal preferences
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-500">
                  These settings only apply to your account.
                </p>
              </div>

              {loadingUserSettings && !userSettings ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, idx) => (
                    <div
                      key={idx}
                      className="h-12 animate-pulse rounded bg-gray-100 dark:bg-zinc-800"
                    />
                  ))}
                </div>
              ) : (
                <form onSubmit={handlePrefSubmit} className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                      Theme
                    </label>
                    <div className="grid gap-3 md:grid-cols-3">
                      {themeOptions.map((option) => (
                        <ThemePreviewTile
                          key={option.value}
                          label={option.label}
                          value={option.value}
                          checked={prefForm.theme === option.value}
                          onChange={(value) =>
                            setPrefForm((prev) => ({
                              ...prev,
                              theme: value as UserPreferences["theme"],
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <PreferenceToggle
                      label="Auto-send messages"
                      description="Automatically send messages when pressing Enter."
                      checked={prefForm.auto_send}
                      onChange={(checked) =>
                        setPrefForm((prev) => ({ ...prev, auto_send: checked }))
                      }
                    />
                    <PreferenceToggle
                      label="Always show sources"
                      description="Expand source citations by default after each answer."
                      checked={prefForm.show_sources}
                      onChange={(checked) =>
                        setPrefForm((prev) => ({
                          ...prev,
                          show_sources: checked,
                        }))
                      }
                    />
                    <PreferenceToggle
                      label="Use personal API key"
                      description={
                        canUsePersonalKey
                          ? "Run chats with your own API quota."
                          : "Add a personal API key to use this option."
                      }
                      checked={
                        prefForm.use_personal_api_key && canUsePersonalKey
                      }
                      disabled={!canUsePersonalKey}
                      onChange={(checked) =>
                        setPrefForm((prev) => ({
                          ...prev,
                          use_personal_api_key: checked,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                      Default chat model
                    </label>
                    <select
                      value={prefForm.default_chat_model}
                      onChange={(e) =>
                        setPrefForm((prev) => ({
                          ...prev,
                          default_chat_model: e.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
                    >
                      {chatModelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className={`inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 disabled:opacity-50 ${updatePreferencesMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                      disabled={
                        updatePreferencesMutation.isPending ||
                        !hasUnsavedChanges
                      }
                    >
                      {updatePreferencesMutation.isPending
                        ? "Saving..."
                        : "Save preferences"}
                    </button>
                    {hasUnsavedChanges &&
                      !updatePreferencesMutation.isPending && (
                        <span className="text-sm text-amber-600 dark:text-amber-400">
                          • Unsaved changes
                        </span>
                      )}
                    {updatePreferencesMutation.isSuccess &&
                      !hasUnsavedChanges && (
                        <span className="text-sm text-green-600 dark:text-green-400">
                          ✓ Saved!
                        </span>
                      )}
                  </div>
                </form>
              )}
            </div>

            {/* Personal API key */}
            <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
                    Personal API key
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-500">
                    Use your own OpenAI key for chat sessions. This never
                    replaces the workspace-wide key.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    userSettings?.personal_api_key_set
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
                  }`}
                >
                  {userSettings?.personal_api_key_set ? "Active" : "Not set"}
                </span>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (personalKeyInput.trim()) {
                    personalKeyMutation.mutate(personalKeyInput.trim());
                  }
                }}
              >
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  OpenAI API key
                </label>
                <input
                  type="password"
                  value={personalKeyInput}
                  onChange={(e) => setPersonalKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className={`inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 disabled:opacity-50 ${personalKeyMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                    disabled={
                      !personalKeyInput || personalKeyMutation.isPending
                    }
                  >
                    {personalKeyMutation.isPending ? "Saving..." : "Save key"}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center rounded-md border border-gray-300 dark:border-zinc-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 ${deletePersonalKeyMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                    disabled={
                      !userSettings?.personal_api_key_set ||
                      deletePersonalKeyMutation.isPending
                    }
                    onClick={() => deletePersonalKeyMutation.mutate()}
                  >
                    Remove key
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Workspace Tab (Admin Only) */}
        {activeTab === "workspace" && isAdmin && (
          <>
            {/* Admin Settings */}
            <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
                    Admin workspace settings
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-500">
                    Applies to all users in this deployment.
                  </p>
                </div>
                <button
                  className={`text-sm font-medium text-danger-600 dark:text-danger-400 hover:underline disabled:opacity-50 ${resetSettingsMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                  disabled={resetSettingsMutation.isPending}
                  onClick={() => resetSettingsMutation.mutate()}
                >
                  Reset to defaults
                </button>
              </div>

              {loadingAdminSettings || !adminForm ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, idx) => (
                    <div
                      key={idx}
                      className="h-12 animate-pulse rounded bg-gray-100 dark:bg-zinc-800"
                    />
                  ))}
                </div>
              ) : (
                <form
                  className="space-y-6"
                  onSubmit={handleAdminSettingsSubmit}
                >
                  <fieldset className="rounded border border-gray-200 dark:border-zinc-700 p-4">
                    <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                      Embeddings
                    </legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <SelectField
                        label="Embedding Model"
                        value={
                          adminForm.embeddings?.model ??
                          "text-embedding-3-small"
                        }
                        onChange={handleEmbeddingModelChange}
                        options={embeddingModelOptions}
                        description="⚠️ Changing this requires re-indexing all documents"
                      />
                      <NumberField
                        label="Chunk size"
                        value={adminForm.embeddings?.chunk_size ?? 1000}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  embeddings: {
                                    ...prev.embeddings,
                                    chunk_size: value,
                                  },
                                }
                              : prev
                          )
                        }
                      />
                      <NumberField
                        label="Chunk overlap"
                        value={adminForm.embeddings?.chunk_overlap ?? 200}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  embeddings: {
                                    ...prev.embeddings,
                                    chunk_overlap: value,
                                  },
                                }
                              : prev
                          )
                        }
                      />
                      <NumberField
                        label="Batch size"
                        value={adminForm.embeddings?.batch_size ?? 100}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  embeddings: {
                                    ...prev.embeddings,
                                    batch_size: value,
                                  },
                                }
                              : prev
                          )
                        }
                      />
                      <NumberField
                        label="Per-second rate limit"
                        value={adminForm.embeddings?.rate_limit ?? 3}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  embeddings: {
                                    ...prev.embeddings,
                                    rate_limit: value,
                                  },
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                  </fieldset>

                  <fieldset className="rounded border border-gray-200 dark:border-zinc-700 p-4">
                    <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                      Chat
                    </legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <SelectField
                        label="Default Chat Model"
                        value={adminForm.chat?.model ?? "gpt-4o-mini"}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  chat: { ...prev.chat, model: value },
                                }
                              : prev
                          )
                        }
                        options={chatModelOptions}
                        description="Workspace default (users can override in their settings)"
                      />
                      <NumberField
                        label="Temperature"
                        step="0.1"
                        value={adminForm.chat?.temperature ?? 0.7}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  chat: { ...prev.chat, temperature: value },
                                }
                              : prev
                          )
                        }
                      />
                      <PreferenceToggle
                        label="Streaming responses"
                        description="Enable server-sent events for faster responses."
                        checked={adminForm.chat?.streaming ?? true}
                        onChange={(checked) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  chat: { ...prev.chat, streaming: checked },
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                  </fieldset>

                  <fieldset className="rounded border border-gray-200 dark:border-zinc-700 p-4">
                    <legend className="px-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
                      Vector search
                    </legend>
                    <div className="grid gap-4 md:grid-cols-2">
                      <NumberField
                        label="Top K"
                        value={adminForm.vectorstore?.k ?? 4}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  vectorstore: {
                                    ...prev.vectorstore,
                                    k: value,
                                  },
                                }
                              : prev
                          )
                        }
                      />
                      <NumberField
                        label="Fetch K (MMR)"
                        value={adminForm.vectorstore?.fetch_k ?? 20}
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  vectorstore: {
                                    ...prev.vectorstore,
                                    fetch_k: value,
                                  },
                                }
                              : prev
                          )
                        }
                      />
                      <SelectField
                        label="Search Type"
                        value={
                          adminForm.vectorstore?.search_type ?? "similarity"
                        }
                        onChange={(value) =>
                          setAdminForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  vectorstore: {
                                    ...prev.vectorstore,
                                    search_type: value,
                                  },
                                }
                              : prev
                          )
                        }
                        options={searchTypeOptions}
                        description="Algorithm for document retrieval"
                      />
                    </div>
                  </fieldset>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className={`inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 disabled:opacity-50 ${updateAdminSettingsMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                      disabled={
                        updateAdminSettingsMutation.isPending ||
                        !hasUnsavedAdminChanges
                      }
                    >
                      {updateAdminSettingsMutation.isPending
                        ? "Saving..."
                        : "Save admin settings"}
                    </button>
                    {hasUnsavedAdminChanges &&
                      !updateAdminSettingsMutation.isPending && (
                        <span className="text-sm text-amber-600 dark:text-amber-400">
                          • Unsaved changes
                        </span>
                      )}
                    {updateAdminSettingsMutation.isSuccess &&
                      !hasUnsavedAdminChanges && (
                        <span className="text-sm text-green-600 dark:text-green-400">
                          ✓ Saved!
                        </span>
                      )}
                  </div>
                </form>
              )}
            </div>

            {/* Global API Key */}
            <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
                    Workspace API key
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-500">
                    Override the default OpenAI key from deployment environment
                    variables.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    globalKeyInfo?.has_override
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
                  }`}
                >
                  {globalKeyInfo?.has_override
                    ? "Admin override active"
                    : "Using .env key"}
                </span>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (globalKeyInput.trim()) {
                    setGlobalKeyMutation.mutate(globalKeyInput.trim());
                  }
                }}
              >
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Override key
                </label>
                <input
                  type="password"
                  value={globalKeyInput}
                  onChange={(e) => setGlobalKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className={`inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 disabled:opacity-50 ${setGlobalKeyMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                    disabled={!globalKeyInput || setGlobalKeyMutation.isPending}
                  >
                    {setGlobalKeyMutation.isPending
                      ? "Saving..."
                      : "Save override"}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center rounded-md border border-gray-300 dark:border-zinc-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 ${clearGlobalKeyMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                    disabled={
                      !globalKeyInfo?.has_override ||
                      clearGlobalKeyMutation.isPending
                    }
                    onClick={() => clearGlobalKeyMutation.mutate()}
                  >
                    Revert to .env key
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Users Tab (Admin Only) */}
        {activeTab === "users" && isAdmin && (
          <>
            {/* User Management */}
            <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
                  User management
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-500">
                  Grant access, promote admins, or deactivate accounts.
                </p>
              </div>

              {loadingUsers ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, idx) => (
                    <div
                      key={idx}
                      className="h-10 animate-pulse rounded bg-gray-100 dark:bg-zinc-800"
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-zinc-300">
                          User
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-zinc-300">
                          Role
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-zinc-300">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600 dark:text-zinc-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
                      {users?.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-zinc-100">
                              {user.email}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500">
                              {user.full_name || "—"}
                            </p>
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
                              className="rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-2 py-1 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none disabled:opacity-50"
                              disabled={user.id === currentUser?.id}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <PreferenceToggle
                              label={user.is_active ? "Active" : "Inactive"}
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
                              className="text-sm font-semibold text-danger-600 dark:text-danger-400 hover:underline disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                              disabled={user.id === currentUser?.id}
                              onClick={() => {
                                if (confirm(`Remove ${user.email}?`)) {
                                  deleteUserMutation.mutate(user.id);
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

              <div className="mt-6 border-t border-gray-200 dark:border-zinc-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  Invite user
                </h3>
                <form
                  className="mt-3 grid gap-4 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createUserMutation.mutate({
                      email: newUserForm.email,
                      password: newUserForm.password,
                      full_name: newUserForm.full_name || undefined,
                      role: newUserForm.role,
                      is_active: newUserForm.is_active,
                    });
                  }}
                >
                  <input
                    type="email"
                    required
                    placeholder="Email"
                    value={newUserForm.email}
                    onChange={(e) =>
                      setNewUserForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Temporary password"
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    className="rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Full name (optional)"
                    value={newUserForm.full_name}
                    onChange={(e) =>
                      setNewUserForm((prev) => ({
                        ...prev,
                        full_name: e.target.value,
                      }))
                    }
                    className="rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
                  />
                  <select
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm((prev) => ({
                        ...prev,
                        role: e.target.value,
                      }))
                    }
                    className="rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <PreferenceToggle
                    label="Active immediately"
                    hideDescription
                    checked={newUserForm.is_active}
                    onChange={(checked) =>
                      setNewUserForm((prev) => ({
                        ...prev,
                        is_active: checked,
                      }))
                    }
                  />
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className={`inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 disabled:opacity-50 ${createUserMutation.isPending ? "cursor-progress" : "cursor-pointer"} disabled:cursor-not-allowed`}
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending
                        ? "Creating..."
                        : "Create user"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Storage Tab */}
        {activeTab === "storage" && (
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
                  Local cache & privacy
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-500">
                  Data stored in your browser keeps the app snappy. You can
                  clear any slice below at any time.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearAllLocalData}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Clear all local data
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded border border-gray-200 dark:border-zinc-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                      Document cache
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      Stats & lists cached from the API.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearQueryCache}
                    className="text-xs font-medium text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                  <div className="flex items-center justify-between">
                    <dt>Size</dt>
                    <dd>{formatBytes(cacheSnapshot.querySizeBytes)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Updated</dt>
                    <dd>{formatTimestamp(cacheSnapshot.queryLastUpdated)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded border border-gray-200 dark:border-zinc-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                      Chat history
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      Last 30 days saved on this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearChatCache}
                    className="text-xs font-medium text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                  <div className="flex items-center justify-between">
                    <dt>Conversations</dt>
                    <dd>{cacheSnapshot.chatSessions}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Messages cached</dt>
                    <dd>{cacheSnapshot.chatMessages}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Updated</dt>
                    <dd>{formatTimestamp(cacheSnapshot.chatLastUpdated)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded border border-gray-200 dark:border-zinc-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                      UI preferences
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      Theme & editor toggles stored locally.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPreferencesCache}
                    className="text-xs font-medium text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                  <div className="flex items-center justify-between">
                    <dt>Theme</dt>
                    <dd className="capitalize">{prefForm.theme}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Updated</dt>
                    <dd>
                      {formatTimestamp(cacheSnapshot.preferencesLastUpdated)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Embedding Model Change Warning Modal */}
        {showEmbeddingWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-w-lg rounded-lg bg-white dark:bg-zinc-900 p-6 shadow-xl">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <svg
                    className="h-6 w-6 text-amber-600 dark:text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    Change Embedding Model?
                  </h3>
                  <div className="mt-2 space-y-2 text-sm text-gray-600 dark:text-zinc-400">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      ⚠️ This is a critical operation that will break existing
                      RAG functionality!
                    </p>
                    <p>Changing the embedding model means:</p>
                    <ul className="ml-5 list-disc space-y-1">
                      <li>
                        All existing document embeddings are incompatible with
                        the new model
                      </li>
                      <li>
                        RAG search will not work correctly until all documents
                        are re-indexed
                      </li>
                      <li>
                        You must delete and re-upload all{" "}
                        <span className="font-semibold">
                          existing documents
                        </span>
                      </li>
                      <li>
                        Different models have different vector dimensions (1536
                        vs 3072)
                      </li>
                    </ul>
                    <p className="mt-3 font-medium text-gray-900 dark:text-zinc-100">
                      Are you absolutely sure you want to change from{" "}
                      <code className="rounded bg-gray-100 dark:bg-zinc-800 px-1 py-0.5">
                        {adminForm?.embeddings?.model ||
                          adminSettings?.embeddings?.model}
                      </code>{" "}
                      to{" "}
                      <code className="rounded bg-gray-100 dark:bg-zinc-800 px-1 py-0.5">
                        {pendingEmbeddingModel}
                      </code>
                      ?
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelEmbeddingModelChange}
                  className="rounded-md border border-gray-300 dark:border-zinc-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmEmbeddingModelChange}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
                >
                  Yes, Change Model
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreferenceToggle({
  label,
  description,
  hideDescription,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  hideDescription?: boolean;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col rounded border border-gray-200 dark:border-zinc-700 px-3 py-3 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          {label}
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:border-zinc-600 dark:bg-zinc-900 dark:text-primary-500 dark:focus:ring-primary-500 disabled:cursor-not-allowed"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
      </div>
      {!hideDescription && description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
          {description}
        </p>
      )}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-zinc-300">
      {label}
      <input
        type="number"
        value={Number(value)}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string; description?: string }>;
  description?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-zinc-300">
      {label}
      {description && (
        <span className="text-xs text-gray-500 dark:text-zinc-500">
          {description}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm focus:border-primary-600 focus:ring-2 focus:ring-primary-600 focus:ring-offset-0 dark:focus:border-primary-500 dark:focus:ring-primary-500 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ThemePreviewTile({
  label,
  value,
  checked,
  onChange,
}: {
  label: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
        checked
          ? "border-primary-600 bg-primary-50/50 dark:border-primary-500 dark:bg-primary-500/10"
          : "border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600"
      }`}
    >
      <input
        type="radio"
        name="theme"
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />

      {/* Preview window */}
      <div
        className={`mb-3 h-28 rounded-md border overflow-hidden ${
          value === "light"
            ? "border-gray-200 bg-gray-50"
            : value === "dark"
              ? "border-zinc-800 bg-zinc-950"
              : "border-gray-200"
        }`}
      >
        {value === "system" ? (
          <div className="flex h-full">
            {/* Light side */}
            <div className="flex-1 bg-gray-50 border-r border-gray-200 p-2 space-y-1.5">
              <div className="h-1.5 w-10 rounded bg-gray-900" />
              <div className="h-1 w-16 rounded bg-gray-500" />
              <div className="flex gap-1 mt-2">
                <div className="h-3 w-8 rounded bg-primary-600 shadow-sm" />
                <div className="h-3 w-8 rounded border border-gray-300 bg-white" />
              </div>
            </div>
            {/* Dark side */}
            <div className="flex-1 bg-zinc-950 p-2 space-y-1.5">
              <div className="h-1.5 w-10 rounded bg-zinc-100" />
              <div className="h-1 w-16 rounded bg-zinc-400" />
              <div className="flex gap-1 mt-2">
                <div className="h-3 w-8 rounded bg-primary-500 shadow-sm" />
                <div className="h-3 w-8 rounded border border-zinc-600 bg-zinc-900" />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full p-2 space-y-1.5">
            {/* Text lines */}
            <div
              className={`h-1.5 w-10 rounded ${value === "light" ? "bg-gray-900" : "bg-zinc-100"}`}
            />
            <div
              className={`h-1 w-16 rounded ${value === "light" ? "bg-gray-500" : "bg-zinc-400"}`}
            />
            <div
              className={`h-1 w-14 rounded ${value === "light" ? "bg-gray-500" : "bg-zinc-400"}`}
            />

            {/* Buttons */}
            <div className="flex gap-1 pt-1">
              <div
                className={`h-3 w-10 rounded shadow-sm ${value === "light" ? "bg-primary-600" : "bg-primary-500"}`}
              />
              <div
                className={`h-3 w-10 rounded border ${value === "light" ? "border-gray-300 bg-white" : "border-zinc-600 bg-zinc-900"}`}
              />
            </div>

            {/* Card/Panel */}
            <div
              className={`mt-1 h-5 rounded border ${value === "light" ? "border-gray-200 bg-white" : "border-zinc-800 bg-zinc-900"}`}
            />
          </div>
        )}
      </div>

      {/* Label and check */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
          {label}
        </span>
        {checked && (
          <svg
            className="h-5 w-5 text-primary-600 dark:text-primary-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    </label>
  );
}
