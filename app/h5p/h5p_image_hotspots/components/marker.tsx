'use client';

import type { KeyboardEvent, PointerEvent } from 'react';
import {
  CircleAlert,
  CircleHelp,
  Info,
  MapPin,
  Plus,
  Star,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { ImageHotspotPointInput } from '../../data/h5p-content-types';

/**
 * The marker drawn on the image, shared by the editor and the player.
 *
 * One component for both because a marker that looks different in the editor
 * from the way it looks to a learner is a marker an author cannot place
 * accurately. The only differences are behavioural, and they are props.
 *
 * The icon map is keyed by the same names `H5pImageHotspots::ICONS` validates
 * against, so an icon the server accepts is always one this can draw.
 */

const ICONS: Record<string, LucideIcon> = {
  plus: Plus,
  info: Info,
  'circle-help': CircleHelp,
  'circle-alert': CircleAlert,
  target: Target,
  'map-pin': MapPin,
  star: Star,
};

export interface MarkerDefaults {
  icon: string;
  color: string;
}

export function resolveMarker(point: Pick<ImageHotspotPointInput, 'icon_name' | 'icon_color' | 'icon_image'>, defaults: MarkerDefaults) {
  return {
    custom: point.icon_image?.trim() || '',
    Icon: ICONS[point.icon_name || defaults.icon] ?? Plus,
    color: point.icon_color?.trim() || defaults.color || '#4f46e5',
  };
}

/** The accessible name, which is never empty — mirrors the server's fallback. */
export function markerName(point: Pick<ImageHotspotPointInput, 'aria_label' | 'header'>, index: number): string {
  return point.aria_label?.trim() || point.header?.trim() || `Hotspot ${index + 1}`;
}

export function HotspotMarker({
  index,
  point,
  defaults,
  showNumber,
  selected,
  opened,
  onPointerDown,
  onKeyDown,
  onFocus,
  onClick,
}: {
  index: number;
  point: ImageHotspotPointInput;
  defaults: MarkerDefaults;
  showNumber: boolean;
  selected?: boolean;
  /** Player only: a hotspot the learner has already read. */
  opened?: boolean;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus?: () => void;
  onClick?: () => void;
}) {
  const { custom, Icon, color } = resolveMarker(point, defaults);
  const name = markerName(point, index);
  const tooltip = point.tooltip?.trim();

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClick={onClick}
      aria-label={name}
      aria-expanded={opened === undefined ? undefined : opened}
      // The native tooltip as well as the styled one below: it is what a
      // touch-and-hold and a browser's own accessibility tooling surface.
      title={tooltip || name}
      className={`group absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        selected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''
      } ${opened ? 'opacity-70' : ''}`}
      style={{
        left: `${point.position_x}%`,
        top: `${point.position_y}%`,
        backgroundColor: custom ? 'transparent' : color,
      }}
    >
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={custom} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <Icon className="h-4 w-4" strokeWidth={2} />
      )}

      {showNumber ? (
        <span
          className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold tabular-nums text-slate-700 shadow"
          aria-hidden="true"
        >
          {index + 1}
        </span>
      ) : null}

      {tooltip ? (
        // Shown on hover AND on focus, so it is reachable from a keyboard.
        // `aria-hidden` because the button's own name already carries it and
        // announcing it twice is noise.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block group-focus-visible:block"
        >
          {tooltip}
        </span>
      ) : null}
    </button>
  );
}
