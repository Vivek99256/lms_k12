'use client';

/**
 * The body of a Fees tab that exists in the navigation but has no backend yet.
 *
 * Several Fees categories are scaffolded ahead of the work: the tabs and their
 * intent are agreed, the screens are not built. Each one renders this card so
 * the shape of the module is visible while staying unmistakably unfinished —
 * the grey chip at the bottom says so on every screen, and nothing here shows
 * invented figures, records or controls that could be mistaken for live data.
 *
 * When a screen is built for real, its entry stops calling this and renders the
 * real thing instead.
 */
export function FeesPlaceholderScreen({
  title,
  summary,
  points,
}: {
  title: string;
  summary: string;
  points: string[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{summary}</p>

      <ul className="mt-4 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5846EA]" />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Placeholder — not connected to live data yet
      </p>
    </section>
  );
}
