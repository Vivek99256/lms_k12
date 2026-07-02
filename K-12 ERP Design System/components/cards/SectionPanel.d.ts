import * as React from "react";

/** Titles and bounds a discrete page section; optionally collapsible. Use to structure long detail/form pages. */
export interface SectionPanelProps extends React.HTMLAttributes<HTMLElement> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Section-level controls (buttons, menu). */
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}
export function SectionPanel(props: SectionPanelProps): JSX.Element;
