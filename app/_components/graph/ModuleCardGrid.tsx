'use client';

/**
 * The reference's `.card`/`.grade-cards` grid, reused for the centralized
 * Knowledge Graph's Modules and Submodules levels (same card component the
 * graph canvas itself uses for a node — same square, same layered
 * drop-shadow, same green fill — rendered as a plain grid rather than
 * positioned on the canvas, since there is no graph of these yet, only a
 * menu of them).
 */

import { coherenceTheme } from './coherence-theme';

export interface ModuleCard {
  key: string;
  title: string;
  subtitle: string;
}

export default function ModuleCardGrid({
  cards,
  onSelect,
  emptyMessage,
}: {
  cards: ModuleCard[];
  onSelect: (key: string) => void;
  emptyMessage?: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm" style={{ color: coherenceTheme.color.text }}>
        {emptyMessage ?? 'Nothing here yet.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-5 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={() => onSelect(card.key)}
          className="flex h-[100px] flex-col items-center justify-center rounded-[2px] border px-3 text-center transition-transform duration-300 hover:-translate-y-0.5"
          style={{
            background: coherenceTheme.color.accent,
            borderColor: coherenceTheme.color.shadowAlt,
            boxShadow: `-3px 3px ${coherenceTheme.color.shadow}, -2px 2px ${coherenceTheme.color.shadow}, -1px 1px ${coherenceTheme.color.shadow}`,
          }}
        >
          <span
            className="line-clamp-2 text-[14px] font-semibold leading-snug text-white"
            style={{ fontFamily: coherenceTheme.font.heading }}
          >
            {card.title}
          </span>
          <span className="mt-1 text-[11px] text-white/80">{card.subtitle}</span>
        </button>
      ))}
    </div>
  );
}
