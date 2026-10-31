'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';

import { checkUploadFile, checkUploadSize, readImageSize } from '@/lib/coursePresentation/draftImages';
import type { ImageCandidate, ImageEditorAdapter, ImageEditResult, ImageEditState, ImageSearch, ImageTarget } from '@/lib/study-deck/imageEditing';
import type { DeckImage } from '@/lib/study-deck/types';

export interface ImageEditDialogProps {
  adapter: ImageEditorAdapter;
  /** The picture being edited: a slide's, or a story scene's. */
  target: ImageTarget;
  /** What to call it in the window: "Slide 3: The water cycle". */
  title: string;
  /** The picture now, or null when there is none to show. */
  current: DeckImage | null;
  /** What may be done with it (the server's answer). */
  state: ImageEditState;
  onClose: () => void;
  onChanged: (result: ImageEditResult) => void;
}

const button = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = `${button} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
const primary = `${button} border-transparent bg-indigo-600 text-white hover:opacity-90`;
const danger = `${button} border-red-300 bg-white text-red-800 hover:bg-red-50`;

type Busy = '' | 'saving' | 'removing' | 'restoring';

/**
 * Add, change or remove the picture on one slide (or story scene), or put the original back. Search for an openly licensed picture or upload your
 * own, look at it beside the current one, then confirm. Shared by every lesson that can be edited: it knows only the adapter's operations.
 * Only this picture changes; the server refuses anything else.
 */
export function ImageEditDialog({ adapter, target, title, current, state, onClose, onChanged }: ImageEditDialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const adding = !state.has_image;
  const mayPick = state.can_add || state.can_replace;
  const [tab, setTab] = useState<'search' | 'upload'>('search');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ImageSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [chosen, setChosen] = useState<ImageCandidate | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const [rights, setRights] = useState(false);
  const [credit, setCredit] = useState('');
  const [alt, setAlt] = useState('');

  const [busy, setBusy] = useState<Busy>('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'' | 'remove' | 'restore'>('');
  const working = useRef(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  // A local preview address is only for looking: it is released when the file changes or the window closes, and never saved anywhere.
  const previewUrl = useRef<string | null>(null);
  const showPreview = (next: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = next ? URL.createObjectURL(next) : null;
    setPreview(previewUrl.current);
  };
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  useEffect(() => () => abort.current?.abort(), []);

  const search = useCallback(
    async (q?: string) => {
      setSearching(true);
      setSearchError('');
      setChosen(null);
      try {
        const res = await adapter.search(target, q);
        setFound(res);
        setQuery((existing) => (q === undefined || existing === '' ? res.query : existing));
      } catch (e) {
        setFound(null);
        setSearchError(e instanceof Error ? e.message : 'The search could not be made.');
      } finally {
        setSearching(false);
      }
    },
    [adapter, target],
  );

  // The first look at the search tab searches with the slide's own words.
  useEffect(() => {
    if (!mayPick) return;
    const timer = setTimeout(() => void search(), 0);
    return () => clearTimeout(timer);
  }, [search, mayPick]);

  const pickFile = async (next: File | null) => {
    setFile(null);
    showPreview(null);
    setFileError('');
    if (!next) return;
    const problem = checkUploadFile(next);
    if (problem) return setFileError(problem);
    try {
      const { width, height } = await readImageSize(next);
      const small = checkUploadSize(width, height);
      if (small) return setFileError(small);
    } catch (e) {
      return setFileError(e instanceof Error ? e.message : 'That file could not be read.');
    }
    setFile(next);
    showPreview(next);
  };

  /** One change at a time: a second click while one is being made does nothing. */
  const change = async (kind: Exclude<Busy, ''>, work: () => Promise<ImageEditResult>) => {
    if (working.current) return;
    working.current = true;
    setBusy(kind);
    setError('');
    setProgress(null);
    try {
      const result = await work();
      onChanged(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The picture could not be changed.');
    } finally {
      working.current = false;
      setBusy('');
      setConfirm('');
    }
  };

  const save = () => {
    if (tab === 'search' && chosen) return change('saving', () => adapter.setFromCandidate(target, chosen.id));
    if (tab === 'upload' && file && rights) {
      abort.current = new AbortController();
      return change('saving', () => adapter.setFromUpload(target, file, { credit, alt, onProgress: setProgress, signal: abort.current?.signal }));
    }
  };

  const canSave = busy === '' && mayPick && ((tab === 'search' && chosen !== null) || (tab === 'upload' && file !== null && rights));
  const newSrc = tab === 'search' ? chosen?.thumbnail_url ?? null : preview;
  const verb = adding ? 'Add image' : 'Replace image';

  return (
    <div className="fixed inset-0 z-[330] flex items-center justify-center bg-slate-900/50 p-3" onMouseDown={(e) => e.target === e.currentTarget && busy === '' && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-edit-title"
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && busy === '' && onClose()}
        className="flex max-h-[92dvh] w-[min(58rem,96vw)] flex-col rounded-2xl bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p id="image-edit-title" className="text-base font-bold text-slate-900">
              {adding ? 'Add image' : 'Change image'}
            </p>
            <p className="text-xs text-slate-600">{title}. Only this picture changes; the text and activities stay as they are.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy !== ''} aria-label="Close" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0 space-y-3">
            {!mayPick ? (
              <p role="status" data-testid="cannot-pick" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {state.reason ?? 'A picture cannot be added or changed here.'}
              </p>
            ) : (
              <>
                <div role="tablist" aria-label="Where the picture comes from" className="flex gap-2">
                  {(
                    [
                      ['search', 'Search images', Search],
                      ['upload', 'Upload image', Upload],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button key={key} type="button" role="tab" aria-selected={tab === key} id={`tab-${key}`} aria-controls={`panel-${key}`} onClick={() => setTab(key)} className={tab === key ? primary : secondary}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'search' ? (
                  <div role="tabpanel" id="panel-search" aria-labelledby="tab-search" className="space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void search(query);
                      }}
                      className="flex gap-2"
                    >
                      <label className="sr-only" htmlFor="image-query">
                        Search words
                      </label>
                      <input id="image-query" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={200} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="What should the picture show?" />
                      <button type="submit" disabled={searching} className={primary}>
                        {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                        Search
                      </button>
                    </form>
                    <p className="text-xs text-slate-600">Only openly licensed pictures are shown. The source and licence are kept with the slide.</p>
                    {searching ? (
                      <p role="status" className="flex items-center gap-2 text-sm text-slate-700">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Searching…
                      </p>
                    ) : null}
                    {searchError ? (
                      <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {searchError} You can upload a picture instead.
                      </p>
                    ) : null}
                    {found && !searching && found.candidates.length === 0 ? (
                      <p role="status" data-testid="no-candidates" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {found.note ?? 'Nothing was found. Change the words, or upload a picture.'}
                      </p>
                    ) : null}
                    {found && found.candidates.length > 0 ? (
                      <ul role="radiogroup" aria-label="Pictures found" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {found.candidates.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={chosen?.id === c.id}
                              onClick={() => setChosen(c)}
                              className={`w-full overflow-hidden rounded-xl border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${chosen?.id === c.id ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-slate-200 hover:border-slate-400'}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- candidate thumbnails come from the picture providers */}
                              <img src={c.thumbnail_url} alt={c.title || 'Candidate picture'} loading="lazy" className="h-28 w-full bg-slate-100 object-cover" />
                              <span className="block space-y-0.5 p-2 text-xs text-slate-700">
                                <span className="block truncate font-medium text-slate-900">{c.title || 'Untitled'}</span>
                                <span className="block truncate">{c.creator ?? 'Unknown creator'}</span>
                                <span className="block truncate">
                                  {c.licence} · {c.provider}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload" className="space-y-3">
                    <label className="block text-sm font-medium text-slate-800" htmlFor="image-file">
                      Picture from your computer
                    </label>
                    <input id="image-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy !== ''} onChange={(e) => void pickFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                    <p className="text-xs text-slate-600">PNG, JPEG or WebP, up to 8 MB, at least 200 × 200 pixels.</p>
                    {fileError ? (
                      <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {fileError}
                      </p>
                    ) : null}
                    <div>
                      <label className="block text-sm font-medium text-slate-800" htmlFor="image-alt">
                        Describe the picture (for screen readers)
                      </label>
                      <input id="image-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800" htmlFor="image-credit">
                        Credit (optional)
                      </label>
                      <input id="image-credit" value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Who made it, if it should be named" />
                    </div>
                    <label className="flex items-start gap-2 text-sm text-slate-800">
                      <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1" />I have the right to use this picture in a lesson.
                    </label>
                  </div>
                )}
              </>
            )}
          </div>

          <aside aria-label="Before and after" className="space-y-3">
            <figure>
              <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Current</figcaption>
              {current ? (
                // eslint-disable-next-line @next/next/no-img-element -- the draft's own stored picture
                <img src={current.url} alt={current.alt} className="aspect-video w-full rounded-lg border border-slate-200 bg-slate-100 object-contain" />
              ) : (
                <div data-testid="no-current" className="flex aspect-video flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 text-xs text-slate-600">
                  <ImageIcon className="h-6 w-6" aria-hidden="true" />
                  No picture yet
                </div>
              )}
            </figure>
            {mayPick ? (
              <figure>
                <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">New</figcaption>
                {newSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a thumbnail from a provider, or the local file chosen to be uploaded
                  <img src={newSrc} alt="Preview of the new picture" data-testid="new-preview" className="aspect-video w-full rounded-lg border border-indigo-600 bg-slate-100 object-contain" />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-600">Choose a picture to preview it here.</div>
                )}
              </figure>
            ) : null}
          </aside>
        </div>

        <div className="space-y-2 border-t border-slate-200 px-4 py-3">
          {busy === 'saving' ? (
            <div role="status" className="space-y-1 text-sm text-slate-700">
              <p className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {tab === 'upload' && progress !== null && progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Saving the picture…'}
              </p>
              {tab === 'upload' && progress !== null ? (
                <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-indigo-600" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
          {busy === 'removing' || busy === 'restoring' ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {busy === 'removing' ? 'Removing the picture…' : 'Restoring the original…'}
            </p>
          ) : null}
          {error ? (
            <p role="alert" data-testid="edit-error" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {confirm !== '' ? (
            <div role="alertdialog" aria-label={confirm === 'remove' ? 'Remove the picture' : 'Restore the original'} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="flex-1">{confirm === 'remove' ? 'Remove this picture? The slide keeps its text and activities, and you can restore the original.' : state.has_image || current ? 'Put the original back on this slide?' : 'Take the added picture off again?'}</span>
              <button
                type="button"
                data-testid="confirm-change"
                className={confirm === 'remove' ? danger : primary}
                disabled={busy !== ''}
                onClick={() => void (confirm === 'remove' ? change('removing', () => adapter.remove(target)) : change('restoring', () => adapter.restore(target)))}
              >
                {confirm === 'remove' ? 'Remove' : 'Restore'}
              </button>
              <button type="button" className={secondary} disabled={busy !== ''} onClick={() => setConfirm('')}>
                Keep it as it is
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {state.can_remove ? (
                <button type="button" data-testid="remove-image" onClick={() => setConfirm('remove')} disabled={busy !== ''} className={danger}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove image
                </button>
              ) : null}
              {state.can_restore ? (
                <button type="button" data-testid="restore-image" onClick={() => setConfirm('restore')} disabled={busy !== ''} className={secondary}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restore original
                </button>
              ) : null}
              <span className="flex-1" />
              <button type="button" onClick={onClose} disabled={busy !== ''} className={secondary}>
                Cancel
              </button>
              {mayPick ? (
                <button type="button" data-testid="replace-image" onClick={() => void save()} disabled={!canSave} className={primary}>
                  {verb}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
