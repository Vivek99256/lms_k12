'use client';

import type { CSSProperties } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';
import { readGraphSession } from '@/app/_components/graph/graph-session';
import { Surface } from '@/components/intelligence/module/primitives';
import { fetchFeesRecommendations, toDisplayCard } from '@/app/fees/recommendation/_lib/fees-recommendation-api';
import { FeesRecommendationCardView } from './recommendation-card';

/** The Fees module's own accent — same literal every other Fees screen uses. */
const FEES_ACCENT = '#5846EA';

/**
 * Fees → Recommendation.
 *
 * Every card on this screen is read straight from Neo4j by
 * `FeesGraphRecommendationController` — no SQL fallback, and no card is ever
 * synthesized client-side. A card that cannot be honestly answered from the
 * graph renders the shared "No Data Available" treatment with the backend's
 * own numeric reason, never a guess — see `FeesRecommendationCardView`.
 *
 * `useBrainResource` is reused as-is: it already keys the fetch on the
 * header's selected academic year and refetches on change, which this panel
 * needs exactly as much as every Brain screen does, despite this panel
 * having nothing to do with the Brain's SQL pipeline.
 */
export function FeesRecommendationScreen() {
  const { data, error, loading, refreshing, refresh } = useBrainResource(async () => {
    const session = readGraphSession();
    const syear = session.academicYear ? String(session.academicYear) : '';

    if (!syear) {
      throw new Error('No academic year is selected.');
    }

    return fetchFeesRecommendations(syear);
  }, []);

  const style = { '--intel-accent': FEES_ACCENT, '--intel-accent-glow': `${FEES_ACCENT}1A` } as CSSProperties;

  if (loading) {
    return (
      <div style={style} className="flex items-center gap-2 px-1 py-16 text-[13px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading the fee graph…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={style} className="px-1 py-6">
        <Surface className="flex items-start gap-3 px-4 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-semibold text-slate-800">Fees recommendations couldn’t be loaded</p>
            <p className="mt-1 text-[13px] leading-5 text-slate-600">{error || 'The request returned nothing.'}</p>
            <div className="mt-3">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div style={style} className="space-y-6 px-1 pb-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--intel-accent)]">
            Recommendation
          </p>
          <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-slate-950">
            Fees — graph-based recommendations
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-slate-500">
            Academic year {data.syear} · read directly from Neo4j. Every card is either a real graph finding or an
            honest reason why one isn’t available yet — never a guess.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </header>

      <ul className="space-y-3">
        {data.cards.map((card) => (
          <li key={card.id}>
            <FeesRecommendationCardView card={toDisplayCard(card)} />
          </li>
        ))}
      </ul>

      <footer className="border-t border-slate-100 pt-3 text-[11.5px] leading-5 text-slate-400">
        Generated {data.generated_at} · source: Neo4j (:FeeRecord, :FeePayment, :Student, :StuDetail)
      </footer>
    </div>
  );
}
