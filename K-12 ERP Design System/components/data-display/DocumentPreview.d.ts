import * as React from "react";

/** Preview a document with viewing controls (certificates, TCs, proofs, receipts). */
export interface DocumentPreviewProps {
  name: React.ReactNode;
  /** Image/thumbnail source; omit for the generic placeholder. */
  src?: string;
  page?: number;
  pageCount?: number;
  state?: "default" | "loading" | "error" | "unsupported";
  onDownload?: () => void;
  onPrint?: () => void;
  className?: string;
}
export function DocumentPreview(props: DocumentPreviewProps): JSX.Element;
