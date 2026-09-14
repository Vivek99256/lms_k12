import type { ProjectAdapter } from '../project-resolver';

/**
 * Shapes shared by the Conversational AI admin API, its store and its screen.
 *
 * Settings are PER PROJECT and PLATFORM-WIDE: they describe how a product's
 * assistant channel behaves, not one school's preference. Tenant-level overrides,
 * if they are ever wanted, layer on top of these rather than replacing them.
 */

export type SuggestedPromptSource = 'workspace' | 'static' | 'none';

export const SUGGESTED_PROMPT_SOURCES: Array<{ value: SuggestedPromptSource; label: string; hint: string }> = [
  { value: 'workspace', label: 'Workspace (backend)', hint: 'Suggestions come from the AI workspace endpoint for the current page.' },
  { value: 'static', label: 'Static list', hint: 'A fixed list the project adapter ships with.' },
  { value: 'none', label: 'None', hint: 'No suggestion chips are shown.' },
];

/** Mirrors hooks/use-voice-interaction.ts; kept here so the server can validate. */
export const CHANNEL_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'gu-IN', label: 'Gujarati' },
];

export interface ProjectChannelSettings {
  project_id: string;
  voice_enabled: boolean;
  /** BCP-47 tag from CHANNEL_LANGUAGES. */
  default_language: string;
  show_ask_tab: boolean;
  show_create_tab: boolean;
  suggested_prompt_source: SuggestedPromptSource;
  /** ISO timestamp, null while the defaults have never been saved. */
  updated_at: string | null;
  updated_by: string | null;
}

export type ChannelSettingsInput = Partial<
  Pick<ProjectChannelSettings, 'voice_enabled' | 'default_language' | 'show_ask_tab' | 'show_create_tab' | 'suggested_prompt_source'>
>;

/** What the store keeps. The plaintext token is never in here. */
export interface StoredServiceToken {
  project_id: string;
  /** SHA-256 hex of the plaintext. */
  hash: string;
  last4: string;
  created_at: string;
  rotated_by: string | null;
}

/** What the admin screen may see. */
export interface ServiceTokenSummary {
  project_id: string;
  /** e.g. `••••••••9f3a`, the pattern the Easy Communication master screens use. */
  masked: string;
  last4: string;
  created_at: string;
  rotated_by: string | null;
}

export interface ProjectAdminRow {
  adapter: ProjectAdapter;
  settings: ProjectChannelSettings;
  /** Null for the host project (no token needed) and for an external one never issued. */
  token: ServiceTokenSummary | null;
}

export interface RotatedToken {
  summary: ServiceTokenSummary;
  /** Shown once, at rotation, and never retrievable again. */
  plaintext: string;
}

export function defaultChannelSettings(projectId: string): ProjectChannelSettings {
  return {
    project_id: projectId,
    voice_enabled: true,
    default_language: 'en-IN',
    show_ask_tab: true,
    show_create_tab: true,
    suggested_prompt_source: 'workspace',
    updated_at: null,
    updated_by: null,
  };
}
