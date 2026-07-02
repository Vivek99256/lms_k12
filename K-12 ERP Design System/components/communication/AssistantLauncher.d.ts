import * as React from "react";

export interface AssistantAgent {
  id: string;
  /** Lucide icon name. */
  icon: string;
  /** Accessible name / tooltip. */
  label: string;
  /** Show an unread dot on this agent. */
  badge?: boolean;
}

/**
 * Floating vertical rail that opens the assistant and switches agents when the
 * panel is collapsed. A primary button opens the assistant; optional agent
 * items select a capability (insights, recommendations, help…).
 */
export interface AssistantLauncherProps {
  items?: AssistantAgent[];
  activeId?: string;
  onSelect?: (id: string) => void;
  primaryIcon?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  className?: string;
}
export function AssistantLauncher(props: AssistantLauncherProps): JSX.Element;
