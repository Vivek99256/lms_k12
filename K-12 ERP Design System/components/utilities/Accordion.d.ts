import * as React from "react";

export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

/** Stacked collapsible sections (FAQs, grouped forms, mobile detail views). */
export interface AccordionProps {
  items: AccordionItem[];
  defaultOpen?: string[];
  /** Allow multiple sections open at once. */
  multiple?: boolean;
  className?: string;
}
export function Accordion(props: AccordionProps): JSX.Element;
