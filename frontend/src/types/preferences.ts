export type ThemePreference = "light" | "dark" | "system";

export type UserPreferences = {
  theme: ThemePreference;
  auto_send: boolean;
  show_sources: boolean;
  default_chat_model: string;
  use_personal_api_key: boolean;
};
