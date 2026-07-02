import * as React from "react";

export interface CommandItem {
  id?: string;
  label: React.ReactNode;
  /** Lucide icon name. */
  icon?: string;
  /** Extra terms to match against beyond the label. */
  keywords?: string;
  /** Rendered as <kbd> chips on the trailing edge, e.g. ["⌘", "K"]. */
  shortcut?: string[];
  onSelect?: () => void;
}

export interface CommandGroup {
  label: React.ReactNode;
  items: CommandItem[];
}

/**
 * Global command / jump-to surface (Cmd/Ctrl-K). Controlled via open/onClose.
 * Type to filter across label + keywords; ↑/↓ to move, ↵ to run, esc to close.
 */
export interface CommandPaletteProps {
  open: boolean;
  onClose?: () => void;
  groups: CommandGroup[];
  placeholder?: string;
}
export function CommandPalette(props: CommandPaletteProps): JSX.Element | null;
