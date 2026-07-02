import * as React from "react";

export interface Comment {
  id: string;
  author: string;
  authorAvatar?: string;
  body: React.ReactNode;
  timestamp: React.ReactNode;
}

/** Display and add comments/notes on a record (PTM notes, approvals, documents). */
export interface CommentThreadProps {
  comments: Comment[];
  /** Omit to render read-only (no composer). */
  onSubmit?: (text: string) => void;
  placeholder?: string;
  className?: string;
}
export function CommentThread(props: CommentThreadProps): JSX.Element;
