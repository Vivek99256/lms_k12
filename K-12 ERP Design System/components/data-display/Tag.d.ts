import * as React from "react";

/** Lightweight label / filter chip. Removable (× control) or selectable (toggle). */
export interface TagProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "neutral" | "brand" | "success" | "warning" | "error" | "info";
  removable?: boolean;
  onRemove?: () => void;
  /** Controlled selected state; makes the tag a toggle button. */
  selected?: boolean;
  size?: "sm" | "md";
  children?: React.ReactNode;
}
export function Tag(props: TagProps): JSX.Element;
