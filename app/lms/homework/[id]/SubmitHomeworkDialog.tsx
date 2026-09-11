"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { submitHomeworkSubmission } from "../api";

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubmitHomeworkDialog({
  open,
  onOpenChange,
  homeworkId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeworkId: number;
  onSubmitted: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [remarks, setRemarks] = useState("");
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setFiles([]);
    setRemarks("");
    setFileError("");
    setError("");
    setSuccess("");
    setProgress(0);
    setSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !submitting) {
      resetState();
    }
    onOpenChange(nextOpen);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (!picked.length) return;

    setError("");
    setSuccess("");
    let nextFiles = [...files];
    let validationError = "";

    for (const file of picked) {
      const extension = fileExtension(file.name);
      const mimeOk = !file.type || ALLOWED_MIME_TYPES.has(file.type);
      if (!ALLOWED_EXTENSIONS.has(extension) || !mimeOk) {
        validationError = `"${file.name}" is not a supported file type. Use PDF, JPG or PNG.`;
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        validationError = `"${file.name}" is larger than 10MB.`;
        continue;
      }
      if (nextFiles.length >= MAX_FILES) {
        validationError = `You can attach up to ${MAX_FILES} files.`;
        continue;
      }
      nextFiles = [...nextFiles, file];
    }

    setFiles(nextFiles);
    setFileError(validationError);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (files.length === 0) {
      setFileError("Attach at least one file.");
      return;
    }

    setSubmitting(true);
    setProgress(0);
    try {
      await submitHomeworkSubmission({
        homeworkId,
        remarks: remarks.trim(),
        files,
        onProgress: setProgress,
      });
      setSuccess("Submitted successfully.");
      setSubmitting(false);
      window.setTimeout(() => {
        resetState();
        onSubmitted();
      }, 700);
    } catch (submitError: unknown) {
      setSubmitting(false);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The submission could not be uploaded. Please try again."
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit homework</DialogTitle>
          <DialogDescription>
            Attach your completed work (PDF, JPG or PNG — up to 5 files, 10MB each).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}
          {success ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
            >
              <CheckCircle2 className="size-4 shrink-0" />
              {success}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="submission-files">Files</Label>
            <input
              ref={inputRef}
              id="submission-files"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleFileSelect}
              disabled={submitting || files.length >= MAX_FILES}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {fileError ? (
              <p className="text-xs text-red-600">{fileError}</p>
            ) : null}

            {files.length ? (
              <ul className="space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700">
                      <Paperclip className="size-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        ({formatBytes(file.size)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={submitting}
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="submission-remarks">Remarks</Label>
            <Textarea
              id="submission-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Add a note for your teacher (optional)"
              rows={3}
              disabled={submitting}
            />
          </div>

          {submitting ? (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-slate-500">Uploading… {progress}%</p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || files.length === 0}>
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Submit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
