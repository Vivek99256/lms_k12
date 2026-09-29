/** What the idle watcher hands to the chatbot panel the moment it fires. */
export interface StuckPromptContext {
  idleSeconds: number;
  pageTitle: string;
  pageType: string | null;
  module: string | null;
  filtersSummary: string | null;
  metricsSummary: string | null;
  availableActionsSummary: string | null;
}
