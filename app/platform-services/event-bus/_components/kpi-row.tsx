'use client';

import { Info, PlugZap, ShieldAlert } from 'lucide-react';

import { Card } from '@/app/platform-services/_components/shell';
import { EVENT_BUS_KPIS, type KpiTile } from '@/lib/event-bus';

/**
 * The six headline measures.
 *
 * NO NUMBER ON THIS ROW IS EVER PRODUCED HERE. The component renders values that
 * came back from the backend and nothing else. When the read API has not answered
 * — because it does not exist yet, or because the call failed — the tile keeps its
 * name and says why it is blank. It does not fall back to zero, to a cached
 * figure, or to anything a fixture once held.
 *
 * WHY A ZERO WOULD BE THE WORST OPTION. "Failed events: 0" is the sentence an
 * operator most wants to read and the one they are least likely to question. If
 * nothing is counting, the tile has to say nothing is counting; the whole reason
 * this screen exists is that a stalled pipeline used to look identical to a
 * healthy one.
 *
 * THE LAYOUT IS FIXED WHETHER OR NOT DATA ARRIVES. Six named tiles either way, so
 * the disconnected state reads as "these are the measures, none is wired" rather
 * than as an empty page that might be still loading.
 */

const VALUE_TONE: Record<KpiTile['tone'], string> = {
  gray: 'text-slate-900',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};

/**
 * A measure the caller is not entitled to.
 *
 * The four outbox tiles are simply absent from the payload for an institute
 * administrator — the API does not compute them, so there is no estate figure in
 * the response at all. If the row rendered only what it was given, those four
 * would silently disappear and the screen would look like it had six measures on
 * Monday and two on Tuesday. So the row is always drawn from the six descriptors,
 * and a measure with no tile and a restricted key says which it is.
 */
function RestrictedTile({ label, source }: { label: string; source: string }) {
  return (
    <Card className="flex flex-col px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-300" aria-hidden="true">—</p>
      <p className="flex-1 text-xs leading-5 text-slate-500">
        <span className="inline-flex items-center gap-1 font-medium text-slate-600">
          <ShieldAlert size={11} className="shrink-0" aria-hidden="true" />
          Super Admin only
        </span>
        <span className="mt-0.5 block">Read from tables with no institute column, so it cannot be limited to your school.</span>
      </p>
      <p className="mt-2 flex items-start gap-1 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400">
        <Info size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{source}</span>
      </p>
    </Card>
  );
}

export function KpiRow({
  tiles,
  loading,
  restrictedSections = [],
}: {
  tiles: KpiTile[] | null;
  loading: boolean;
  /** KPI keys the API withheld — rendered from the descriptor list instead. */
  restrictedSections?: string[];
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {EVENT_BUS_KPIS.map((descriptor) => (
          <Card key={descriptor.key} className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{descriptor.label}</p>
            <div className="mt-2.5 h-7 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
          </Card>
        ))}
      </div>
    );
  }

  // Nothing came back. Name the six measures and say, per tile, why each is
  // blank — never a value, never a zero.
  if (!tiles) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {EVENT_BUS_KPIS.map((descriptor) => (
          <Card key={descriptor.key} className="flex flex-col px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{descriptor.label}</p>

            <p className="mt-1 text-2xl font-semibold text-slate-300" aria-hidden="true">—</p>

            <p className="flex-1 text-xs leading-5 text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                <PlugZap size={11} className="shrink-0" aria-hidden="true" />
                {descriptor.blocked ? 'Not yet available' : 'Data source not connected'}
              </span>
              <span className="mt-0.5 block">
                {descriptor.blocked
                  ? 'No table in this database can produce this measure yet.'
                  : descriptor.hint}
              </span>
            </p>

            <p
              className="mt-2 flex items-start gap-1 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400"
              title={`Will be read from ${descriptor.source}`}
            >
              <Info size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{descriptor.source}</span>
            </p>
          </Card>
        ))}
      </div>
    );
  }

  // Always six cells, in descriptor order, so the row keeps its shape whichever
  // tier the caller is in. A tile the API sent is rendered; one it withheld is
  // named and explained; anything else simply is not offered by this build.
  const byKey = new Map(tiles.map((tile) => [tile.key, tile]));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {EVENT_BUS_KPIS.map((descriptor) => {
        const tile = byKey.get(descriptor.key);

        if (!tile) {
          return restrictedSections.includes(descriptor.key) ? (
            <RestrictedTile key={descriptor.key} label={descriptor.label} source={descriptor.source} />
          ) : null;
        }

        return (
        <Card key={tile.key} className="flex flex-col px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>

          {/* `available: false` is the backend saying it could not compute this
              one. It stays a dash — the row never substitutes a value. */}
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${tile.available ? VALUE_TONE[tile.tone] : 'text-slate-300'}`}>
            {tile.available ? tile.value : '—'}
          </p>

          <p className="mt-0.5 flex-1 text-xs leading-5 text-slate-500">
            {tile.available ? tile.hint : 'Not yet available'}
          </p>

          <p
            className="mt-2 flex items-start gap-1 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400"
            title={`Read from ${tile.source}`}
          >
            <Info size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{tile.source}</span>
          </p>
        </Card>
        );
      })}
    </div>
  );
}
