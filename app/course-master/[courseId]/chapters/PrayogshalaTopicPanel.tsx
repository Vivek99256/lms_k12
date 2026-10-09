'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchPrayogshalaForChapter,
  generatePrayogshalaActivity,
  PrayogshalaApiError,
  updatePrayogshalaActivity,
  type PrayogshalaActivity,
  type PrayogshalaTopicEntry,
  type PrayogshalaTopicState,
} from '../../data/prayogshala';

/**
 * Topic-wise Prayogshala for one chapter: every topic with the ONE activity filed against it.
 *
 * Nothing here knows a chapter or a subject. The rows come from the backend (topic_master joined
 * to the activity table), so a new standard, subject, chapter or topic appears with no frontend
 * change. Each row shows the real state - not generated, generating, ready for review, published,
 * failed, or needs more source content - and staff can generate, retry, regenerate and publish.
 * Learners only receive topics that have a published activity.
 *
 * The parent keys this component by chapter, so changing chapter starts clean and one chapter's
 * topics are never left on screen under another.
 */

const STATE_LABEL: Record<PrayogshalaTopicState, string> = {
  not_generated: 'Not generated',
  generating: 'Generating…',
  ready: 'Ready for review',
  published: 'Published',
  failed: 'Failed',
  needs_content: 'Needs more source content',
};

const STATE_STYLE: Record<PrayogshalaTopicState, string> = {
  not_generated: 'bg-slate-100 text-slate-600',
  generating: 'bg-sky-100 text-sky-700',
  ready: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  needs_content: 'bg-orange-100 text-orange-800',
};

interface Props {
  chapterId: number;
  canManage: boolean;
  /** Bumped by the parent when the chapter's content list reloads. */
  reloadKey: number;
  onOpenLab: (activity: PrayogshalaActivity) => void;
  /** Called after this panel changes data, so the parent can reload the chapter's content list. */
  onChanged: () => void;
}

export function PrayogshalaTopicPanel({ chapterId, canManage, reloadKey, onOpenLab, onChanged }: Props) {
  const [topics, setTopics] = useState<PrayogshalaTopicEntry[] | null>(null);
  const [error, setError] = useState('');
  const [busyTopic, setBusyTopic] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchPrayogshalaForChapter(chapterId);
      setTopics(data.topic_coverage ?? []);
    } catch (e: unknown) {
      setError(e instanceof PrayogshalaApiError && e.status === 401 ? e.message : e instanceof Error ? e.message : 'Could not load the topics.');
    }
  }, [chapterId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load, reloadKey]);

  // A topic another request is generating: look again in a few seconds instead of leaving a stale chip.
  const anyGenerating = topics?.some((t) => t.state === 'generating') ?? false;
  useEffect(() => {
    if (!anyGenerating) return;
    const timer = window.setTimeout(() => void load(), 6000);
    return () => window.clearTimeout(timer);
  }, [anyGenerating, topics, load]);

  const run = async (entry: PrayogshalaTopicEntry, regenerate: boolean) => {
    if (regenerate && !window.confirm(`Regenerate the activity for "${entry.topic_name}"? The current version is replaced and goes back to review.`)) return;
    setBusyTopic(entry.topic_id);
    setNotice('');
    try {
      const result = await generatePrayogshalaActivity(entry.topic_id, regenerate);
      if (result.outcome === 'needs_content') setNotice(`"${entry.topic_name}" needs more source content before an activity can be made.`);
      else if (result.outcome === 'busy') setNotice(`"${entry.topic_name}" is already being generated.`);
      else if (result.outcome === 'queued') setNotice(`"${entry.topic_name}" is queued for generation.`);
      else if (result.outcome === 'exists') setNotice(`"${entry.topic_name}" already has an activity.`);
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setBusyTopic(null);
      await load();
      onChanged();
    }
  };

  const publish = async (entry: PrayogshalaTopicEntry) => {
    if (!entry.activity) return;
    setBusyTopic(entry.topic_id);
    setNotice('');
    try {
      await updatePrayogshalaActivity(entry.activity.id, { title: entry.activity.title, status: 'published' });
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'Could not publish.');
    } finally {
      setBusyTopic(null);
      await load();
      onChanged();
    }
  };

  if (error) {
    return (
      <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
        <span>{error}</span>
        <Button type="button" variant="ghost" onClick={() => void load()} className="h-9 rounded-full bg-white px-4 text-rose-700">Try again</Button>
      </div>
    );
  }
  if (topics === null) {
    return <div className="mb-5 h-24 animate-pulse rounded-2xl bg-slate-100" aria-label="Loading topics" />;
  }
  if (topics.length === 0) {
    return null;
  }

  const done = topics.filter((t) => t.state === 'published' || t.state === 'ready').length;

  return (
    <section className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/70 p-4 sm:p-5" aria-label="Prayogshala by topic">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Prayogshala by topic</h3>
        {canManage ? (
          <span className="text-xs text-slate-500">{done} of {topics.length} topics have an activity</span>
        ) : null}
      </div>
      {notice ? <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">{notice}</p> : null}
      <ul className="divide-y divide-indigo-100">
        {topics.map((entry) => {
          const activity = entry.activity;
          const busy = busyTopic === entry.topic_id;
          const hasLab = !!activity?.lab_config;
          return (
            <li key={entry.topic_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{entry.topic_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {entry.concept_count} concept{entry.concept_count === 1 ? '' : 's'}
                  {hasLab && activity ? ` · ${activity.title}` : ''}
                </p>
                {canManage && activity?.generation_error ? (
                  <p className="mt-1 text-xs text-rose-600">{activity.generation_error}</p>
                ) : null}
                {canManage && entry.state === 'not_generated' && !entry.has_description && entry.concept_count === 0 ? (
                  <p className="mt-1 text-xs text-orange-700">This topic has little source content; generation may report that it needs more.</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_STYLE[entry.state]}`}>
                  {busy ? 'Working…' : STATE_LABEL[entry.state]}
                </span>
                {hasLab && activity ? (
                  <Button type="button" onClick={() => onOpenLab(activity)} className="h-9 rounded-full bg-[#4f46e5] px-4 text-xs font-semibold text-white hover:bg-[#4338ca]">
                    <FlaskConical size={14} className="mr-1.5" /> Open lab
                  </Button>
                ) : null}
                {canManage && entry.state === 'ready' && hasLab ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void publish(entry)} className="h-9 rounded-full px-4 text-xs">Publish</Button>
                ) : null}
                {canManage && (entry.state === 'not_generated' || entry.state === 'failed' || entry.state === 'needs_content') ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void run(entry, false)} className="h-9 rounded-full px-4 text-xs">
                    {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : entry.state === 'not_generated' ? <Sparkles size={14} className="mr-1.5" /> : <RefreshCw size={14} className="mr-1.5" />}
                    {entry.state === 'not_generated' ? 'Generate' : 'Try again'}
                  </Button>
                ) : null}
                {canManage && hasLab && activity?.editable && (entry.state === 'ready' || entry.state === 'published') ? (
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(entry, true)} className="h-9 rounded-full px-3 text-xs text-slate-600">
                    <RefreshCw size={14} className="mr-1.5" /> Regenerate
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
