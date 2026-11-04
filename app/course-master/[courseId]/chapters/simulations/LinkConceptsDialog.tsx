'use client';

import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import {
  describeSimulationError,
  simulationService,
  type SimulationCard,
  type SimulationConceptOption,
} from '@/app/course-master/data/simulations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CITATION_MAX,
  REASON_MAX,
  buildLinksPayload,
  draftsFromLinks,
  linkDraftProblems,
  linksChanged,
  type LinkDraft,
  type LinkRole,
  type SimulationLink,
} from '@/lib/simulation-links';
import { cn } from '@/lib/utils';

const SELECT = 'h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';
const WARN_STATUSES = new Set(['flagged', 'low_confidence']);

/**
 * "Link to concepts": which concepts of the curriculum this simulation helps teach. Authors only - the parent mounts it when the SERVER said the
 * session may author, and every call below is checked again on the server (a session outside the platform tenant gets 403 and sees the message).
 *
 * The picker offers the concepts of THIS chapter. The chapter, topic, standard and subject of each link are worked out by the server from the
 * concept, so the editor never sends them; a link made earlier to another chapter stays in the list and is sent back unchanged. Saving replaces
 * the set; a new link starts in review and a learner sees it only after it is published here.
 */
export function LinkConceptsDialog({
  card,
  chapterId,
  onClose,
  onChanged,
}: {
  card: SimulationCard;
  chapterId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const searchId = useId();
  const [saved, setSaved] = useState<SimulationLink[] | null>(null);
  const [drafts, setDrafts] = useState<LinkDraft[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SimulationConceptOption[] | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [busyLink, setBusyLink] = useState<number | null>(null);
  const [failure, setFailure] = useState<{ message: string; problems: string[] } | null>(null);
  const [note, setNote] = useState('');

  // The links the server holds for this simulation.
  useEffect(() => {
    let live = true;
    simulationService
      .links(card.id)
      .then((links) => {
        if (!live) return;
        setSaved(links);
        setDrafts(draftsFromLinks(links));
      })
      .catch((err: unknown) => live && setLoadError(describeSimulationError(err, 'The links could not be loaded.').message));
    return () => {
      live = false;
    };
  }, [card.id]);

  // The concepts of this chapter, narrowed by what was typed (after a short pause, newest answer only).
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      simulationService
        .concepts(chapterId, query, controller.signal)
        .then((rows) => {
          setOptions(rows);
          setPickerError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setPickerError(describeSimulationError(err, 'The concepts could not be loaded.').message);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [chapterId, query]);

  const dirty = saved !== null && linksChanged(drafts, saved);
  const problems = linkDraftProblems(drafts);
  const linked = new Set(drafts.map((draft) => draft.concept_id));

  const add = (option: SimulationConceptOption) => {
    if (linked.has(option.id)) return;
    setNote('');
    setDrafts((current) => [
      ...current,
      {
        concept_id: option.id,
        concept_name: option.name,
        topic_name: option.topic_name,
        chapter_id: option.chapter_id,
        chapter_name: null,
        role: current.some((d) => d.role === 'primary') ? 'supporting' : 'primary',
        citation: '',
        reason: '',
      },
    ]);
  };

  const change = (conceptId: number, patch: Partial<Pick<LinkDraft, 'role' | 'citation' | 'reason'>>) =>
    setDrafts((current) => current.map((draft) => (draft.concept_id === conceptId ? { ...draft, ...patch } : draft)));

  const remove = (conceptId: number) => setDrafts((current) => current.filter((draft) => draft.concept_id !== conceptId));

  const save = async () => {
    if (saving || problems.length > 0) return;
    setSaving(true);
    setFailure(null);
    setNote('');
    try {
      const links = await simulationService.putLinks(card.id, buildLinksPayload(drafts).links);
      setSaved(links);
      setDrafts(draftsFromLinks(links));
      setNote('Saved. A new link waits for review: publish it below when the subject teacher has checked it.');
      onChanged();
    } catch (err) {
      setFailure(describeSimulationError(err, 'The links could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const review = async (link: SimulationLink) => {
    if (busyLink !== null) return;
    setBusyLink(link.id);
    setFailure(null);
    setNote('');
    try {
      await simulationService.reviewLink(card.id, link.id, link.review_status === 'published' ? 'review' : 'published');
      const links = await simulationService.links(card.id);
      setSaved(links);
      // Only the review state changed on the server; what the person is typing for the other links is kept.
      setDrafts((current) => current.map((draft) => ({ ...draft, review_status: links.find((l) => l.concept_id === draft.concept_id)?.review_status ?? draft.review_status })));
      onChanged();
    } catch (err) {
      setFailure(describeSimulationError(err, 'The review state could not be changed.'));
    } finally {
      setBusyLink(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="mb-0 space-y-1.5 border-b border-slate-200 px-6 pb-4 pt-6">
          <DialogTitle>Link “{card.title}” to concepts</DialogTitle>
          <DialogDescription>
            A learner sees this simulation under a concept only after that link is published. Choose concepts from this chapter; links you made to other chapters are kept as they are.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section aria-label="Linked concepts" className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Linked concepts {saved ? `(${drafts.length})` : ''}</h3>
            {loadError ? (
              <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {loadError}
              </p>
            ) : saved === null ? (
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" aria-label="Loading links" />
            ) : drafts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">Not linked to any concept yet. Add one from the list below.</p>
            ) : (
              <ul className="space-y-3">
                {drafts.map((draft) => {
                  const server = saved.find((link) => link.concept_id === draft.concept_id);
                  const rowDirty = !server || server.role !== draft.role || (server.citation ?? '').trim() !== draft.citation.trim() || (server.reason ?? '').trim() !== draft.reason.trim();
                  const published = server?.review_status === 'published';
                  return (
                    <li key={draft.concept_id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{draft.concept_name ?? `Concept ${draft.concept_id}`}</p>
                          <p className="text-xs text-slate-500">{[draft.chapter_name, draft.topic_name].filter(Boolean).join(' · ') || (server ? '' : 'This chapter')}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                            !server ? 'border-slate-200 bg-slate-50 text-slate-600' : published ? 'border-emerald-300 bg-emerald-100 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900',
                          )}
                        >
                          {!server ? 'Not saved' : published ? 'Published' : 'In review'}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_1fr]">
                        <label className="space-y-1 text-xs font-medium text-slate-600">
                          Role
                          <select className={cn(SELECT, 'block w-full')} value={draft.role} onChange={(event) => change(draft.concept_id, { role: event.target.value as LinkRole })}>
                            <option value="primary">Main concept</option>
                            <option value="supporting">Supporting</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-xs font-medium text-slate-600">
                          Textbook section
                          <Input value={draft.citation} maxLength={CITATION_MAX} placeholder="e.g. Section 3.2, page 41" onChange={(event) => change(draft.concept_id, { citation: event.target.value })} />
                        </label>
                      </div>
                      <label className="mt-2 block space-y-1 text-xs font-medium text-slate-600">
                        Why it belongs here
                        <Textarea value={draft.reason} maxLength={REASON_MAX} rows={2} placeholder="One sentence for the reviewer and the learner" onChange={(event) => change(draft.concept_id, { reason: event.target.value })} />
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {server ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={rowDirty || busyLink !== null}
                            onClick={() => void review(server)}
                            className="gap-1.5 rounded-full"
                            title={rowDirty ? 'Save your changes first' : undefined}
                          >
                            {busyLink === server.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : published ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                            {published ? 'Unpublish link' : 'Publish link'}
                          </Button>
                        ) : null}
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(draft.concept_id)} className="gap-1.5 rounded-full text-rose-700">
                          <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="Add a concept" className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Add a concept from this chapter</h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input id={searchId} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search concepts" className="pl-8" aria-label="Search the concepts of this chapter" />
            </div>
            {pickerError ? (
              <p className="text-sm text-rose-700" role="alert">
                {pickerError}
              </p>
            ) : options === null ? (
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" aria-label="Loading concepts" />
            ) : options.length === 0 ? (
              <p className="text-sm text-slate-500">No concept of this chapter matches.</p>
            ) : (
              <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {options.map((option) => {
                  const already = linked.has(option.id);
                  return (
                    <li key={option.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-900">{option.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {option.topic_name ?? 'No topic'}
                          {option.review_status && WARN_STATUSES.has(option.review_status) ? <span className="ml-2 font-medium text-amber-700">{option.review_status === 'flagged' ? 'Flagged concept' : 'Low confidence'}</span> : null}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" disabled={already} onClick={() => add(option)} className="shrink-0 gap-1.5 rounded-full" aria-label={already ? `${option.name} is already linked` : `Link ${option.name}`}>
                        {already ? <CheckCircle2 className="size-3.5 text-emerald-700" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                        {already ? 'Linked' : 'Add'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {problems.length > 0 ? (
            <ul className="list-disc space-y-1 rounded-xl border border-amber-300 bg-amber-50 py-3 pl-8 pr-4 text-xs text-amber-900" role="alert">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}

          {failure ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {failure.message}
              </p>
              {failure.problems.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-6 text-xs">
                  {failure.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {note ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
              {note}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!dirty || saving || problems.length > 0} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save links'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
