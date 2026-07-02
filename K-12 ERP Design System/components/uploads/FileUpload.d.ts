import * as React from "react";

export interface UploadFile {
  id: string;
  name: string;
  size?: string;
  status?: "uploading" | "success" | "error";
  progress?: number;
}

/** Dropzone + file list with a click alternative and per-file progress. */
export interface FileUploadProps {
  files?: UploadFile[];
  onFiles?: (files: File[]) => void;
  onRemove?: (file: UploadFile) => void;
  accept?: string;
  multiple?: boolean;
  hint?: string;
  className?: string;
}
export function FileUpload(props: FileUploadProps): JSX.Element;
