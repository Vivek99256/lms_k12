import * as React from "react";

export interface AssistantMessage {
  id?: string;
  role: "assistant" | "user";
  text: React.ReactNode;
  /** Optional timestamp label (e.g. "10:00 AM"). */
  time?: string;
}

export type AssistantSuggestion = string | { text: string; icon?: string };

/**
 * Docked AI copilot / agent surface (right dock). Hosts a chat thread, suggestion
 * chips, a typing indicator and a composer. Controlled — pass messages, handle onSend.
 *
 * @startingPoint section="Communication" subtitle="Docked AI assistant panel with chat + composer" viewport="360x640"
 */
export interface AssistantPanelProps {
  title?: string;
  status?: React.ReactNode;
  messages?: AssistantMessage[];
  suggestions?: AssistantSuggestion[];
  typing?: boolean;
  placeholder?: string;
  onSend?: (text: string) => void;
  onClose?: () => void;
  onNewChat?: () => void;
  className?: string;
}
export function AssistantPanel(props: AssistantPanelProps): JSX.Element;
