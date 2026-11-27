'use client';

import { EvidenceGrid, NoData, SeverityChip, SeverityRail, resolveTone } from '@/components/intelligence/module/primitives';
import type { PalRecommendationDisplayCard } from '@/app/pal/recommendation/_lib/pal-recommendation-api';

/**
 * Priority (Major/Medium/Minor) is additive to severity, not a replacement
 * for it — severity still drives the rail/dot colour via `resolveTone`.
 * The palette below is the same ramp `TONES` in primitives.tsx already uses
 * for critical/medium/low chips, just not re-exported from that file, so the
 * values are matched by hand rather than invented: Major reads as the same
 * red as a high/critical severity chip, Medium the same amber, Minor the
 * same slate. Square corners (not `rounded-full`, no dot) are the one
 * deliberate difference, so a priority badge never reads as a second
 * severity chip at a glance.
 */
const PRIORITY_STYLES: Record<PalRecommendationDisplayCard['priority'], string> = {
  Major: 'bg-red-50 text-red-800 ring-red-200',
  Medium: 'bg-amber-50 text-amber-900 ring-amber-200',
  Minor: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function PriorityBadge({ priority }: { priority: PalRecommendationDisplayCard['priority'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ring-inset ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}

/**
 * One PAL Recommendation card. Mirrors `FeesRecommendationCardView` exactly
 * (Surface + SeverityRail + SeverityChip + title + body + EvidenceGrid),
 * with one addition: a priority badge next to the severity chip, and the
 * backend's own `priorityReason` as a muted caption under the title — see
 * `PalCrossModuleInsightEngine`/`PalGraphReasoningEngine`/
 * `PalPredictiveInsightReader`, which compute `priority` from the same real
 * counts each card already carries, never an invented score.
 */
export function PalRecommendationCardView({ card }: { card: PalRecommendationDisplayCard }) {
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
          <PriorityBadge priority={card.priority} />
          <span className="text-[12px] text-slate-500">{card.category}</span>
        </div>

        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-slate-900">{card.title}</h3>

        {card.priorityReason ? (
          <p className="mt-0.5 text-[12px] leading-5 text-slate-500">{card.priorityReason}</p>
        ) : null}

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
