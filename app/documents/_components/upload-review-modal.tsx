'use client';

import { useState } from 'react';
import { UploadCloud, AlertTriangle, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IdmsApi, type DocumentItem, type DocumentWarning } from '../_lib/idms-api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentConfirmed: (doc: DocumentItem) => void;
}

export function UploadReviewModal({ isOpen, onClose, onDocumentConfirmed }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'select' | 'uploading' | 'processing' | 'review'>('select');
  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const [reviewDoc, setReviewDoc] = useState<DocumentItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form edit fields during review
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<DocumentItem['tags']>([]);
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const startUpload = async () => {
    if (!file) return;
    setError(null);
    setStep('uploading');

    try {
      const res = await IdmsApi.uploadDocument(file);
      const docId = res.data?.id;
      setUploadedDocId(docId);
      setStep('processing');

      // Poll until document is ready_for_review or failed
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const detailRes = await IdmsApi.getDocument(docId);
          const doc = detailRes.data;
          if (doc.processing_status === 'ready_for_review' || doc.processing_status === 'done') {
            clearInterval(interval);
            setReviewDoc(doc);
            setTitle(doc.title);
            setDocType(doc.document_type || '');
            setAcademicYear(doc.academic_year || '');
            setSummary(doc.summary || '');
            setTags(doc.tags || []);
            setStep('review');
          } else if (doc.processing_status === 'failed') {
            clearInterval(interval);
            setError(doc.processing_error || 'Processing pipeline encountered an error.');
            setStep('select');
          } else if (attempts > 30) {
            clearInterval(interval);
            // Fallback load whatever is ready
            setReviewDoc(doc);
            setStep('review');
          }
        } catch (err) {
          if (attempts > 30) {
            clearInterval(interval);
            setError(err instanceof Error ? err.message : "Couldn't read the processing status.");
            setStep('select');
          }
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload failed.');
      setStep('select');
    }
  };

  const handleTagToggle = (idx: number, newStatus: 'accepted' | 'rejected') => {
    const updated = [...tags];
    updated[idx] = { ...updated[idx], status: newStatus };
    setTags(updated);
  };

  const handleConfirm = async () => {
    if (!uploadedDocId) return;
    setConfirming(true);
    try {
      const res = await IdmsApi.confirmDocument(uploadedDocId, {
        title,
        document_type: docType,
        academic_year: academicYear,
        summary,
        tags,
      });
      onDocumentConfirmed(res.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm the document.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        {step === 'select' && (
          <div>
            <h2 className="text-xl font-bold text-slate-900">Upload Once, Organize Automatically</h2>
            <p className="mt-1 text-sm text-slate-500">
              The AI engine will read, classify, tag, extract metadata, and file your document instantly.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-indigo-500 bg-slate-50"
            >
              <UploadCloud className="h-12 w-12 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                {file ? file.name : 'Drag and drop files here, or click to browse'}
              </p>
              <p className="mt-1 text-xs text-slate-500">PDF, DOCX, XLSX, PPTX, Images up to 50MB</p>
              <input
                type="file"
                className="hidden"
                id="file-upload"
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
              />
              <label htmlFor="file-upload">
                <Button variant="outline" size="sm" className="mt-4 cursor-pointer" type="button" onClick={() => document.getElementById('file-upload')?.click()}>
                  Browse Device
                </Button>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button disabled={!file} onClick={startUpload} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Upload & Process
              </Button>
            </div>
          </div>
        )}

        {(step === 'uploading' || step === 'processing') && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-600" />
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {step === 'uploading' ? 'Uploading to Secure Spaces Storage...' : 'Analyzing & Understanding Document...'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Running text extraction, optical character recognition (OCR), AI entity parsing, and duplicate check.
            </p>
          </div>
        )}

        {step === 'review' && reviewDoc && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold text-sm">AI Intelligent Review Ready</span>
              <span className="ml-auto text-xs bg-indigo-50 text-indigo-700 font-medium px-2 py-0.5 rounded-full">
                Confidence: {Math.round((reviewDoc.confidence || 0.8) * 100)}%
              </span>
            </div>

            {/* Logical location badge */}
            <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700 flex items-center gap-1.5 overflow-x-auto">
              <span className="font-semibold text-slate-900">Logical Location:</span>
              <span>{reviewDoc.logical_location.path}</span>
            </div>

            {/* Warnings banner */}
            {reviewDoc.warnings && reviewDoc.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                {reviewDoc.warnings.map((w: DocumentWarning, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{typeof w === 'string' ? w : w.message || w.type}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Document Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Detected Type</label>
                  <input
                    type="text"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Academic Year</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Executive Summary</label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Suggested Tags (Accept / Reject)</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((t, idx) => (
                    <div
                      key={idx}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                        t.status === 'accepted'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : t.status === 'rejected'
                          ? 'bg-slate-100 text-slate-400 line-through border-slate-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <span>{t.name}</span>
                      {t.status !== 'accepted' && (
                        <button
                          type="button"
                          onClick={() => handleTagToggle(idx, 'accepted')}
                          className="hover:text-emerald-900 font-bold"
                          title="Accept tag"
                        >
                          ✓
                        </button>
                      )}
                      {t.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => handleTagToggle(idx, 'rejected')}
                          className="hover:text-red-900 font-bold"
                          title="Reject tag"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t">
              <Button variant="ghost" onClick={onClose}>Discard</Button>
              <Button
                disabled={confirming}
                onClick={handleConfirm}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & Publish
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
