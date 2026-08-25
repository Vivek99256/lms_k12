'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Save, Sparkles, Trash2, X } from 'lucide-react';
import {
  createScenario,
  generateScenarioAI,
  h5pContextQuery,
  hasH5pContext,
  readH5pContext,
  type H5pContext,
  type ScenarioPointInput,
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
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import { Textarea } from '@/components/ui/textarea';

/**
 * Scenario based learning — create page.
 * Mirrors Laravel `resources/views/lms/h5p/scenario/create.blade.php`:
 * upload an image, click it to drop interactive points, optionally let AI
 * generate the description + points.
 */

interface PointModalState {
  /** Index in the points array; null while adding a new point. */
  index: number | null;
  title: string;
  description: string;
  x: number;
  y: number;
}

/** Replicates the Blade AI prompt template. */
function buildAiPrompt(title: string, ctx: H5pContext): string {
  return `Create educational content for an interactive image-based learning scenario.

Title: "${title}"
Subject: ${ctx.subject_name ?? ''}
Standard/Grade: ${ctx.standard_name ?? ''}
Chapter: ${ctx.chapter_name ?? ''}

Generate a JSON response with this exact structure:
{
  "description": "<An engaging HTML description of the scenario image and its educational context (2-3 paragraphs)>",
  "points": [
    { "title": "<Short point title>", "description": "<HTML description of this point of interest>", "x": <number 0-100>, "y": <number 0-100> }
  ]
}

Rules: return 4-6 points. x and y are percentages (0-100) of the image width and height marking where each point of interest sits. Respond with JSON only.`;
}

/** Clamp a pixel coordinate at least 15px inside the displayed image, like the Blade JS. */
function clampToImage(value: number, size: number): number {
  const margin = 15;
  if (size <= margin * 2) return Math.round(size / 2);
  return Math.round(Math.min(Math.max(value, margin), size - margin));
}

function ScenarioCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [points, setPoints] = useState<ScenarioPointInput[]>([]);
  const [modal, setModal] = useState<PointModalState | null>(null);
  const [modalError, setModalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; image?: string }>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const modalOpen = modal !== null;
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setPoints([]);
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    if (!file) {
      setImagePreview('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setModalError('');
    setModal({ index: null, title: '', description: '', x, y });
  };

  const openPoint = (index: number) => {
    const point = points[index];
    if (!point) return;
    setModalError('');
    setModal({ index, title: point.title, description: point.description, x: point.x, y: point.y });
  };

  const savePoint = () => {
    if (!modal) return;
    const pointTitle = modal.title.trim();
    if (!pointTitle) {
      setModalError('Point title is required.');
      return;
    }
    if (modal.index === null) {
      setPoints((prev) => [
        ...prev,
        { id: null, title: pointTitle, description: modal.description, x: modal.x, y: modal.y },
      ]);
    } else {
      setPoints((prev) =>
        prev.map((point, i) =>
          i === modal.index ? { ...point, title: pointTitle, description: modal.description } : point
        )
      );
    }
    setModal(null);
  };

  const deletePoint = () => {
    if (!modal) return;
    if (modal.index !== null) {
      const removeIndex = modal.index;
      setPoints((prev) => prev.filter((_, i) => i !== removeIndex));
    }
    setModal(null);
  };

  const handleGenerateAI = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !imagePreview) return;
    setAiLoading(true);
    setError('');
    try {
      const result = await generateScenarioAI({
        prompt: buildAiPrompt(trimmedTitle, ctx),
        image: imagePreview,
        title: trimmedTitle,
        standard: ctx.standard_name ?? '',
        chapter: ctx.chapter_name ?? '',
        subject: ctx.subject_name ?? '',
      });
      setDescription(result.description);
      const width = imgRef.current?.clientWidth ?? 0;
      const height = imgRef.current?.clientHeight ?? 0;
      const mapped: ScenarioPointInput[] = result.points.map((point) => ({
        id: null,
        title: point.title,
        description: point.description,
        x: clampToImage((point.x / 100) * width, width),
        y: clampToImage((point.y / 100) * height, height),
      }));
      setPoints(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    const errs: { title?: string; image?: string } = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!imageFile) errs.image = 'Please choose a scenario image.';
    setFieldErrors(errs);
    if (errs.title || errs.image) return;
    if (points.length === 0 && !window.confirm('No interactive points added. Continue without points?')) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await createScenario(ctx, {
        title: title.trim(),
        description,
        points,
        image: imageFile,
      });
      router.push(`/h5p/scenario_based?${h5pContextQuery(ctx, { flash: result.message })}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <H5pPageHeader
          title="Add scenario"
          description="Upload an image and click on it to place interactive points"
          ctx={ctx}
          backHref={`/h5p/scenario_based?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : (
          <>
            <InlineBanner kind="error" message={error} onDismiss={() => setError('')} />

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="space-y-5">
                <div>
                  <Label htmlFor="scenario-title">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="scenario-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, title: undefined }));
                    }}
                    placeholder="Scenario title"
                    className="mt-1.5"
                  />
                  {fieldErrors.title ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="scenario-image">
                    Image <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="scenario-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="mt-1.5"
                  />
                  {fieldErrors.image ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.image}</p>
                  ) : null}
                </div>

                {imagePreview ? (
                  <div>
                    <p className="mb-2 text-xs text-slate-500">
                      Click anywhere on the image to add an interactive point. Click a numbered
                      marker to edit or remove it.
                    </p>
                    <div className="relative inline-block max-w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={imgRef}
                        src={imagePreview}
                        alt="Scenario preview"
                        onClick={handleImageClick}
                        className="block h-auto max-w-full cursor-crosshair rounded-xl border border-slate-200"
                      />
                      {points.map((point, index) => (
                        <button
                          key={`${point.x}-${point.y}-${index}`}
                          type="button"
                          onClick={() => openPoint(index)}
                          style={{ left: point.x, top: point.y }}
                          className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow"
                          title={point.title}
                          aria-label={`Point ${index + 1}: ${point.title}`}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                    {points.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {points.map((point, index) => (
                          <button
                            key={`badge-${index}`}
                            type="button"
                            onClick={() => openPoint(index)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                          >
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              {index + 1}
                            </span>
                            {point.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="scenario-description">
                      Description
                      <span className="text-xs font-normal text-slate-400">Rich HTML supported</span>
                    </Label>
                    <Button
                      onClick={handleGenerateAI}
                      disabled={aiLoading || !title.trim() || !imagePreview}
                      className="rounded-xl bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                    >
                      {aiLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {aiLoading ? 'Generating…' : 'Generate AI'}
                    </Button>
                  </div>
                  <Textarea
                    id="scenario-description"
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the scenario (HTML allowed)…"
                    className="mt-1.5"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/h5p/scenario_based?${contextQuery}`)}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="rounded-xl bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {saving ? 'Saving…' : 'Save Scenario'}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {modal.index === null ? 'Add interactive point' : `Edit point ${modal.index + 1}`}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="point-title">
                  Point title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="point-title"
                  value={modal.title}
                  maxLength={100}
                  onChange={(e) => {
                    setModal({ ...modal, title: e.target.value });
                    setModalError('');
                  }}
                  placeholder="Short point title"
                  className="mt-1.5"
                />
                {modalError ? <p className="mt-1 text-xs text-red-600">{modalError}</p> : null}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="point-description">
                    Description
                    <span className="text-xs font-normal text-slate-400">HTML supported</span>
                  </Label>
                  <AiFieldAssistant
                    value={modal.description}
                    onApply={(next) => setModal({ ...modal, description: next })}
                    fieldType="lesson_content"
                    label="Hotspot description"
                    module="h5p"
                    page="Scenario based"
                    entityType="h5p_scenario_point"
                    related={{ 'Hotspot title': modal.title ?? '' }}
                  />
                </div>
                <Textarea
                  id="point-description"
                  rows={4}
                  value={modal.description}
                  onChange={(e) => setModal({ ...modal, description: e.target.value })}
                  placeholder="What does this point highlight?"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              {modal.index !== null ? (
                <Button variant="destructive" onClick={deletePoint} className="rounded-xl">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete point
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setModal(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={savePoint}
                  className="rounded-xl bg-[#4f46e5] text-white hover:bg-[#4338ca]"
                >
                  Save point
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ScenarioCreatePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <ScenarioCreateContent />
    </Suspense>
  );
}
