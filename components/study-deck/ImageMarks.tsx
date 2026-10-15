import type { ImageMark, MarkInset } from '@/lib/study-deck/types';

/** One colour per tone, each with a white halo so it reads on a pale, a dark and a pink part of a picture alike. */
const STROKE = { primary: '#059669', secondary: '#1d4ed8' } as const;
const FILL = { primary: 'rgba(5, 150, 105, 0.14)', secondary: 'rgba(29, 78, 216, 0.14)' } as const;

function pointsOf(mark: ImageMark): string {
  return mark.points.map(([x, y]) => `${x},${y}`).join(' ');
}

/**
 * The structures a card is about, drawn over the picture it names.
 *
 * It is an SVG laid over the picture box with a 0-100 coordinate system (`preserveAspectRatio="none"`), the same box the picture
 * fills, so every point stays on its structure when the picture is drawn at any size. Strokes keep their pixel width
 * (`non-scaling-stroke`) so a line never thins out or fattens with the stretch. It takes no pointer events: the picture and its
 * pins underneath stay usable.
 */
export function ImageMarks({ marks, testId = 'image-marks' }: { marks: ImageMark[]; testId?: string }) {
  if (marks.length === 0) return null;

  return (
    <svg aria-hidden="true" data-testid={testId} viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
      {marks.map((mark, index) => {
        const Shape = mark.shape === 'area' ? 'polygon' : 'polyline';
        const common = { points: pointsOf(mark), fill: 'none', strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' } as const;

        return (
          <g key={index} data-tone={mark.tone}>
            <Shape {...common} stroke="#ffffff" strokeWidth={7} opacity={0.9} />
            <Shape {...common} stroke={STROKE[mark.tone]} strokeWidth={3.5} fill={mark.shape === 'area' ? FILL[mark.tone] : 'none'} />
          </g>
        );
      })}
    </svg>
  );
}

/** A small drawing for a card whose subject is not in the picture, with the words that explain it. */
export function MarkInsetView({ inset }: { inset: MarkInset }) {
  return (
    <figure className="flex items-center gap-[0.8em]">
      <div className="relative aspect-square h-[7.5em] shrink-0 rounded-[0.6em] border border-sd-line bg-white">
        <ImageMarks marks={inset.marks} testId="inset-marks" />
      </div>
      <figcaption className="text-[0.85em] leading-snug text-slate-700">{inset.caption}</figcaption>
    </figure>
  );
}

/** What each colour on the picture stands for, so a highlight is never colour alone. */
export function MarkLegend({ marks, label }: { marks: ImageMark[]; label: string }) {
  const tones = Array.from(new Set(marks.map((m) => m.tone)));
  if (tones.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-[0.4em] text-[0.8em] font-semibold text-slate-700">
      {tones.map((tone) => (
        <span key={tone} aria-hidden="true" className="inline-block h-[0.7em] w-[1.6em] rounded-full ring-2 ring-white" style={{ backgroundColor: STROKE[tone] }} />
      ))}
      <span>Highlighted: {label}</span>
    </span>
  );
}
