import * as React from "react";

export interface TreeNodeData {
  id: string;
  label: React.ReactNode;
  icon?: string;
  badge?: React.ReactNode;
  children?: TreeNodeData[];
}

/**
 * Navigate hierarchical structures (academic setup, org, settings nav).
 * Canonical tree — use for settings-nav instead of a bespoke component.
 */
export interface TreeViewProps {
  nodes: TreeNodeData[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Node ids expanded by default. */
  defaultExpanded?: string[];
  className?: string;
}
export function TreeView(props: TreeViewProps): JSX.Element;
