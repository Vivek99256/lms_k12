export interface DeckPinProps {
  /** Zero-based; the pin shows the number the parts list shows. */
  index: number;
  /** Where the pin sits, in percent of the picture. */
  x: number;
  y: number;
  name: string;
  selected: boolean;
  explored: boolean;
  onSelect: () => void;
  /** A small picture (a phone): the pin shrinks so several do not pile up; the parts list is the larger target there. */
  compact?: boolean;
  /** Undoes the camera's zoom (1 / zoom), so a pin keeps its size while the picture under it grows. */
  scale?: number;
  /** Shown beside the selected pin, so the picture itself says what is selected. */
  callout?: string;
  /** The callout opens to the left of the pin (a pin near the right edge). */
  calloutLeft?: boolean;
}

/**
 * The numbered pin on a diagram: a small round number, not an icon in a ring.
 *
 * The old pin was the H5P marker (a 36px disc, a white border, an icon, a second badge for the number and a pulsing ring), which
 * was larger than most organelles and hid the diagram it pointed at. This one is a 20px disc with the number in it, a white
 * hairline so it reads on a dark or a coloured part of a picture, and an indigo border. Selected, it fills with the accent and
 * grows a little; explored, its border turns green. The button around it is 24px so it is still an easy target.
 */
export function DeckPin({ index, x, y, name, selected, explored, onSelect, compact = false, scale = 1, callout, calloutLeft = false }: DeckPinProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={name}
      aria-pressed={selected}
      title={name}
      data-testid="deck-pin"
      data-selected={selected ? 'true' : undefined}
      className={`group absolute z-20 flex ${compact ? 'h-5 w-5' : 'h-6 w-6'} -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sd-accent`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span aria-hidden="true" className="relative flex items-center justify-center transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scale(${scale})` }}>
      <span
        className={`flex items-center justify-center rounded-full ${compact ? 'text-[9px]' : 'text-[12px]'} font-bold leading-none tabular-nums shadow-[0_0_0_1.5px_#ffffff,0_1px_3px_rgba(15,23,42,0.35)] transition-[transform,background-color] duration-150 motion-reduce:transition-none ${
          selected
            ? `${compact ? 'h-5 w-5' : 'h-6 w-6'} scale-100 border-2 border-sd-accent bg-sd-accent text-white`
            : `${compact ? 'h-4 w-4' : 'h-[22px] w-[22px]'} border-[1.5px] bg-white text-slate-900 group-hover:scale-110 ${explored ? 'border-emerald-600' : 'border-sd-accent'}`
        }`}
      >
        {index + 1}
      </span>
      {callout ? (
        <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-sd-accent bg-white px-1.5 py-0.5 text-[12px] font-bold text-sd-strong shadow-md ${calloutLeft ? 'right-full mr-1.5' : 'left-full ml-1.5'}`}>{callout}</span>
      ) : null}
      </span>
    </button>
  );
}
