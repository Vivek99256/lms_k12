'use client';

import { EvidenceGrid, NoData, SeverityChip, SeverityRail, resolveTone } from '@/components/intelligence/module/primitives';
import type { FeesRecommendationDisplayCard } from '@/app/fees/recommendation/_lib/fees-recommendation-api';

/**
 * One Fees Recommendation card. Mirrors the shape of the shared
 * `FindingCard`/`RecommendationCard` in `components/intelligence/module/sections.tsx`
 * (Surface + SeverityRail + SeverityChip + title + body + EvidenceGrid) using
 * the same shared primitives, but built locally rather than through
 * `FindingsSection`/`RecommendationsSection`: those batch a section's
 * availability into one shared "nothing to show, here's why" state, while
 * this panel's whole point is that each of the five cards carries its own
 * independent available/reason — a thin, non-fabricated graph finding next
 * to an honest "not enough data yet" card, never merged into one.
 */
export function FeesRecommendationCardView({ card }: { card: FeesRecommendationDisplayCard }) {
  if (!card.available) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <SeverityRail tone="low" />
        <div className="pl-4">
          <NoData bare detail={card.title} reason={card.reason} hint={null} />
        </div>
      </div>
    );
  }

  const tone = resolveTone(card.severity);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <SeverityRail tone={tone} />
      <div className="py-4 pl-5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip tone={tone}>{card.severity}</SeverityChip>
          <span className="text-[12px] text-slate-500">{card.category}</span>
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{card.title}</h3>

        {card.description ? (
          <p className="mt-1.5 text-[13.5px] leading-6 text-slate-700">{card.description}</p>
        ) : null}

        {card.impactLine ? (
          <p className="mt-1.5 text-[12.5px] text-slate-600">
            <span className="font-semibold text-slate-700">Expected: </span>
            {card.impactLine}
          </p>
        ) : null}

        {card.evidencePoints.length > 0 ? (
          <div className="mt-3">
            <EvidenceGrid points={card.evidencePoints} />
          </div>
        ) : null}

        {card.listItems.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[12.5px] leading-5 text-slate-600">
            {card.listItems.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
