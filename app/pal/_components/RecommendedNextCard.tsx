'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Compass, ExternalLink, Sparkles, Unlock } from 'lucide-react';
import { fetchRecommendationFeed, type RecommendationFeedData } from '@/app/pal/data/pal';

const ACTION_COPY: Record<string, { label: string; icon: typeof Sparkles }> = {
  consolidate: { label: 'Keep going', icon: Sparkles },
  unblock: { label: 'Clear the blocker', icon: Unlock },
  advance: { label: 'Move forward', icon: ArrowRight },
};

/**
 * "What should I do next" — a self-view-only nudge for the signed-in student,
 * backed by GET /api/pal/recommendations/next (fully built already; this is
 * its first frontend caller). Additive and best-effort: a failed fetch hides
 * the card rather than blocking the rest of the PAL page, since nothing else
 * on this page depends on it.
 */
export function RecommendedNextCard() {
  const [data, setData] = useState<RecommendationFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetchRecommendationFeed({ signal: controller.signal })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (failed) return null;

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="h-3 w-24 rounded bg-slate-100" />
        <div className="mt-3 h-4 w-3/4 rounded bg-slate-100" />
        <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
      </div>
    );
  }

  if (!data || (!data.action && !data.reason)) return null;

  const copy = ACTION_COPY[data.action] ?? { label: data.action || 'Suggested next step', icon: Compass };
  const Icon = copy.icon;

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-white px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{copy.label}</span>
            {data.targetConceptName && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                {data.targetConceptName}
              </span>
            )}
          </div>
          {data.reason && <p className="mt-1.5 text-xs text-slate-600">{data.reason}</p>}

          {data.contentTitle && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="min-w-0 truncate text-xs font-medium text-slate-700">{data.contentTitle}</span>
              {data.contentUrl && (
                <a
                  href={data.contentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {(data.careerNarrative || data.careerMessage) && (
            <p className="mt-2 text-xs italic text-slate-500">
              {data.careerNarrative || data.careerMessage}
            </p>
          )}

          <p className="mt-2 text-[11px] font-medium text-slate-400">
            {data.graphAware
              ? 'Based on your prerequisite map'
              : data.hasScope
                ? 'Based on your recent activity'
                : 'Based on your overall activity'}
          </p>
        </div>
      </div>
    </div>
  );
}
