'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  createVideo,
  h5pContextQuery,
  hasH5pContext,
  parseTimeToSeconds,
  readH5pContext,
  type VideoInteractionInput,
  type VideoInteractionType,
} from '../../data/h5p';
import {
  H5pPageHeader,
  InlineBanner,
  LoadingState,
  MissingContextNotice,
} from '../../components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Interactive video create — mirrors Laravel `GET /h5p/h5p_interactive_video/create`
 * (resources/views/lms/h5p/interactiveVideo/create.blade.php).
 */

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm';

const TYPE_OPTIONS: Array<{ value: VideoInteractionType; label: string }> = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'text_input', label: 'Info Card (text)' },
];

const NATIVE_SELECT_CLASS =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50';

interface RowErrors {
  time?: string;
  question?: string;
  options?: string;
  correct?: string;
}

interface InteractionRow {
  time: string;
  type: VideoInteractionType;
  question: string;
  /** Multiple-choice option labels (A, B, C, …). */
  options: string[];
  /** MC: 1-based index string. TF: "1" | "2". Text: optional expected answer. */
  correct: string;
  errors: RowErrors;
}

function newRow(): InteractionRow {
  return { time: '', type: 'multiple_choice', question: '', options: ['', '', '', ''], correct: '', errors: {} };
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function validateVideoFile(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!VIDEO_EXTENSIONS.includes(ext)) {
    return 'Invalid file type. Allowed: mp4, mov, avi, mkv, webm.';
  }
  if (file.size >= MAX_VIDEO_BYTES) {
    return 'The video must be smaller than 500MB.';
  }
  return '';
}

function validateRow(row: InteractionRow): RowErrors {
  const errors: RowErrors = {};
  const seconds = parseTimeToSeconds(row.time);
  if (seconds === null) {
    errors.time = 'Enter a time as seconds, mm:ss or hh:mm:ss.';
  }
  if (!row.question.trim()) {
    errors.question = row.type === 'text_input' ? 'Info text is required.' : 'Question is required.';
  } else if (row.question.length > 500) {
    errors.question = 'Maximum 500 characters.';
  }
  if (row.type === 'multiple_choice') {
    if (row.options.length < 4 || row.options.some((option) => !option.trim())) {
      errors.options = 'All options are required (minimum 4).';
    }
    if (!row.correct) {
      errors.correct = 'Select the correct answer.';
    }
  } else if (row.type === 'true_false' && !row.correct) {
    errors.correct = 'Select True or False.';
  }
  return errors;
}

function InteractiveVideoCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const previewUrlRef = useRef('');
  const [rows, setRows] = useState<InteractionRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const contextQuery = h5pContextQuery(ctx);

  const applyPreview = (nextFile: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = nextFile ? URL.createObjectURL(nextFile) : '';
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  const handleFileChange = (selected: File | null) => {
    if (!selected) {
      setFile(null);
      setFileError('');
      applyPreview(null);
      return;
    }
    const message = validateVideoFile(selected);
    if (message) {
      setFile(null);
      setFileError(message);
      applyPreview(null);
      return;
    }
    setFile(selected);
    setFileError('');
    applyPreview(selected);
  };

  const updateRow = (index: number, updater: (row: InteractionRow) => InteractionRow) => {
    setRows((prev) => prev.map((row, i) => (i === index ? updater(row) : row)));
  };

  const handleTypeChange = (index: number, type: VideoInteractionType) => {
    updateRow(index, (row) => ({
      ...row,
      type,
      options: type === 'multiple_choice' ? ['', '', '', ''] : [],
      correct: '',
      errors: { ...row.errors, options: undefined, correct: undefined },
    }));
  };

  const handleTimeBlur = (index: number) => {
    updateRow(index, (row) => {
      if (!row.time.trim()) return row;
      const seconds = parseTimeToSeconds(row.time);
      if (seconds === null) {
        return { ...row, errors: { ...row.errors, time: 'Enter a time as seconds, mm:ss or hh:mm:ss.' } };
      }
      return { ...row, time: String(seconds), errors: { ...row.errors, time: undefined } };
    });
  };

  const handleSubmit = async () => {
    setError('');

    let valid = true;
    if (!title.trim()) {
      setTitleError('Title is required.');
      valid = false;
    } else {
      setTitleError('');
    }
    if (!file) {
      setFileError((prev) => prev || 'A video file is required.');
      valid = false;
    }

    const validatedRows = rows.map((row) => {
      const errors = validateRow(row);
      if (Object.keys(errors).length > 0) valid = false;
      return { ...row, errors };
    });
    setRows(validatedRows);

    if (!valid || !file) return;

    const interactions: VideoInteractionInput[] = validatedRows.map((row) => ({
      time: parseTimeToSeconds(row.time) ?? 0,
      interaction_type: row.type,
      question: row.question.trim(),
      options: row.type === 'multiple_choice' ? row.options.map((option) => option.trim()) : [],
      correct_answer: row.correct,
    }));

    setSaving(true);
    try {
      const result = await createVideo(ctx, { title: title.trim(), interactions, videoFile: file });
      router.push(`/h5p/h5p_interactive_video?${h5pContextQuery(ctx, { flash: result.message })}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create video');
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Add interactive video"
          description="Upload a video and add timed questions or info cards"
          ctx={ctx}
          backHref={`/h5p/h5p_interactive_video?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="video-title" className="text-slate-700">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="video-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={255}
                    placeholder="e.g. Photosynthesis explained"
                    disabled={saving}
                  />
                  {titleError ? <p className="text-xs text-red-600">{titleError}</p> : null}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="video-file" className="text-slate-700">
                    Video file <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="video-file"
                    type="file"
                    accept={VIDEO_ACCEPT}
                    onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    disabled={saving}
                    className="h-auto py-1.5"
                  />
                  <p className="text-xs text-slate-500">Allowed: mp4, mov, avi, mkv, webm. Maximum size 500MB.</p>
                  {fileError ? <p className="text-xs text-red-600">{fileError}</p> : null}
                  {previewUrl ? (
                    <video controls className="w-full rounded-xl" src={previewUrl} />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Interactions</h2>
                <Button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, newRow()])}
                  disabled={saving}
                  className="bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add interaction
                </Button>
              </div>

              <div className="grid gap-4">
                {rows.map((row, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Interaction {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                        disabled={rows.length === 1 || saving}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Remove interaction"
                        aria-label="Remove interaction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label className="text-slate-700">
                          Time <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={row.time}
                          onChange={(e) =>
                            updateRow(index, (r) => ({
                              ...r,
                              time: e.target.value,
                              errors: { ...r.errors, time: undefined },
                            }))
                          }
                          onBlur={() => handleTimeBlur(index)}
                          placeholder="e.g. 30, 11:50, 1:30:00"
                          disabled={saving}
                        />
                        {row.errors.time ? <p className="text-xs text-red-600">{row.errors.time}</p> : null}
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-slate-700">Type</Label>
                        <select
                          value={row.type}
                          onChange={(e) => handleTypeChange(index, e.target.value as VideoInteractionType)}
                          disabled={saving}
                          className={NATIVE_SELECT_CLASS}
                        >
                          {TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-1.5">
                      <Label className="text-slate-700">
                        {row.type === 'text_input' ? 'Info text' : 'Question'} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={row.question}
                        onChange={(e) =>
                          updateRow(index, (r) => ({
                            ...r,
                            question: e.target.value,
                            errors: { ...r.errors, question: undefined },
                          }))
                        }
                        maxLength={500}
                        placeholder={
                          row.type === 'text_input' ? 'The fact or note to show' : 'The question to ask at this time'
                        }
                        disabled={saving}
                      />
                      {row.errors.question ? <p className="text-xs text-red-600">{row.errors.question}</p> : null}
                    </div>

                    {row.type === 'multiple_choice' ? (
                      <div className="mt-3 grid gap-3">
                        <div className="grid gap-2">
                          {row.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                                {optionLetter(optionIndex)}
                              </span>
                              <Input
                                value={option}
                                onChange={(e) =>
                                  updateRow(index, (r) => ({
                                    ...r,
                                    options: r.options.map((o, oi) => (oi === optionIndex ? e.target.value : o)),
                                    errors: { ...r.errors, options: undefined },
                                  }))
                                }
                                placeholder={`Option ${optionLetter(optionIndex)}`}
                                disabled={saving}
                              />
                              {optionIndex >= 4 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateRow(index, (r) => {
                                      const nextOptions = r.options.filter((_, oi) => oi !== optionIndex);
                                      const correctIndex = Number(r.correct);
                                      let correct = r.correct;
                                      if (correctIndex === optionIndex + 1) correct = '';
                                      else if (correctIndex > optionIndex + 1) correct = String(correctIndex - 1);
                                      return { ...r, options: nextOptions, correct };
                                    })
                                  }
                                  disabled={saving}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                  title="Remove option"
                                  aria-label="Remove option"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {row.errors.options ? <p className="text-xs text-red-600">{row.errors.options}</p> : null}
                        <div className="flex flex-wrap items-end gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => updateRow(index, (r) => ({ ...r, options: [...r.options, ''] }))}
                            disabled={saving}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add option
                          </Button>
                          <div className="grid min-w-40 gap-1.5">
                            <Label className="text-slate-700">
                              Correct answer <span className="text-red-500">*</span>
                            </Label>
                            <select
                              value={row.correct}
                              onChange={(e) =>
                                updateRow(index, (r) => ({
                                  ...r,
                                  correct: e.target.value,
                                  errors: { ...r.errors, correct: undefined },
                                }))
                              }
                              disabled={saving}
                              className={NATIVE_SELECT_CLASS}
                            >
                              <option value="">Select…</option>
                              {row.options.map((_, optionIndex) => (
                                <option key={optionIndex} value={String(optionIndex + 1)}>
                                  Option {optionLetter(optionIndex)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {row.errors.correct ? <p className="text-xs text-red-600">{row.errors.correct}</p> : null}
                      </div>
                    ) : null}

                    {row.type === 'true_false' ? (
                      <div className="mt-3 grid gap-1.5">
                        <Label className="text-slate-700">
                          Correct answer <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-5">
                          {[
                            { value: '1', label: 'True' },
                            { value: '2', label: 'False' },
                          ].map((choice) => (
                            <label key={choice.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                              <input
                                type="radio"
                                name={`tf-correct-${index}`}
                                value={choice.value}
                                checked={row.correct === choice.value}
                                onChange={() =>
                                  updateRow(index, (r) => ({
                                    ...r,
                                    correct: choice.value,
                                    errors: { ...r.errors, correct: undefined },
                                  }))
                                }
                                disabled={saving}
                                className="h-4 w-4 accent-[#4f46e5]"
                              />
                              {choice.label}
                            </label>
                          ))}
                        </div>
                        {row.errors.correct ? <p className="text-xs text-red-600">{row.errors.correct}</p> : null}
                      </div>
                    ) : null}

                    {row.type === 'text_input' ? (
                      <div className="mt-3 grid gap-1.5">
                        <Label className="text-slate-700">Expected answer</Label>
                        <Input
                          value={row.correct}
                          onChange={(e) => updateRow(index, (r) => ({ ...r, correct: e.target.value }))}
                          placeholder="Leave blank if any answer is acceptable"
                          disabled={saving}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  'Save Video'
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function InteractiveVideoCreatePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <InteractiveVideoCreateContent />
    </Suspense>
  );
}
