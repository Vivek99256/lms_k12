'use client';

import { useRef, useState } from 'react';
import type { SlideElementInput, SlideInput } from '../../data/h5p-content-types';
import type { SlideElementType } from '@/lib/h5p/course-presentation-scoring';

/**
 * The slide authoring canvas: positioned element boxes over a 16:9 surface.
 *
 * GEOMETRY IS A PERCENTAGE OF THE SLIDE. Nothing converts to pixels until this
 * component measures its own box, which is what lets one authored deck render
 * correctly on a phone and a projector.
 *
 * KEYBOARD PLACEMENT IS NOT OPTIONAL. Every element box is a button; arrow
 * keys move the selected one and shift+arrows resize it. An author who cannot
 * use a pointer can lay out a slide, which is not true of H5P's own editor.
 *
 * WHAT THIS DELIBERATELY IS NOT is a rendering of the element. A multiple
 * choice shows as a labelled box, not as a working question. The canvas is for
 * LAYOUT; the preview is one click away and is the real thing. A canvas that
 * half-renders its elements ends up being neither.
 */

const THEME_SURFACE: Record<string, string> = {
  default: 'bg-white',
  slate: 'bg-slate-100',
  indigo: 'bg-indigo-50',
  warm: 'bg-amber-50',
  'high-contrast': 'bg-white',
};

const ELEMENT_TONE: Record<string, string> = {
  text: 'border-slate-300 bg-slate-50/90 text-slate-700',
  image: 'border-sky-300 bg-sky-50/90 text-sky-800',
  video: 'border-sky-300 bg-sky-50/90 text-sky-800',
  audio: 'border-sky-300 bg-sky-50/90 text-sky-800',
  multiple_choice: 'border-indigo-300 bg-indigo-50/90 text-indigo-800',
  true_false: 'border-indigo-300 bg-indigo-50/90 text-indigo-800',
  blanks: 'border-indigo-300 bg-indigo-50/90 text-indigo-800',
  drag_drop: 'border-indigo-300 bg-indigo-50/90 text-indigo-800',
  goto_slide: 'border-emerald-300 bg-emerald-50/90 text-emerald-800',
};

const STEP = 2; // percent per arrow press
const STEP_FINE = 0.5;

export function SlideCanvas({
  slide,
  theme,
  selected,
  disabled,
  labels,
  onSelect,
  onMove,
  onResize,
}: {
  slide: SlideInput;
  theme: string;
  selected: number | null;
  disabled?: boolean;
  labels: Record<SlideElementType, string>;
  onSelect: (index: number | null) => void;
  onMove: (index: number, x: number, y: number) => void;
  onResize: (index: number, width: number, height: number) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ index: number; offsetX: number; offsetY: number } | null>(null);

  const percentAt = (clientX: number, clientY: number) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: ((clientX - box.left) / box.width) * 100,
      y: ((clientY - box.top) / box.height) * 100,
    };
  };

  return (
    <div
      ref={canvasRef}
      className={`relative w-full select-none overflow-hidden rounded-xl border border-slate-200 ${
        THEME_SURFACE[theme] ?? THEME_SURFACE.default
      }`}
      style={{ aspectRatio: '16 / 9' }}
      onPointerMove={(e) => {
        if (!dragging || disabled) return;
        const position = percentAt(e.clientX, e.clientY);
        if (!position) return;
        const element = slide.elements[dragging.index];
        // Clamped so an element cannot be dragged off the slide entirely —
        // recovering one that has been is impossible without editing the JSON.
        onMove(
          dragging.index,
          Math.max(0, Math.min(100 - element.width, position.x - dragging.offsetX)),
          Math.max(0, Math.min(100 - element.height, position.y - dragging.offsetY))
        );
      }}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {slide.background_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.background_image}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {slide.elements.length === 0 ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
          Empty slide — add text, media or a question above.
        </p>
      ) : null}

      {slide.elements.map((element, index) => {
        const isSelected = selected === index;
        return (
          <button
            key={index}
            type="button"
            onPointerDown={(e) => {
              if (disabled) return;
              e.stopPropagation();
              onSelect(index);
              const position = percentAt(e.clientX, e.clientY);
              if (position) {
                // The grab offset, so an element does not jump its top-left
                // corner to the cursor the moment a drag starts.
                setDragging({
                  index,
                  offsetX: position.x - element.position_x,
                  offsetY: position.y - element.position_y,
                });
              }
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              const step = e.altKey ? STEP_FINE : STEP;
              const moves: Record<string, [number, number]> = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              };
              const move = moves[e.key];
              if (!move) return;
              e.preventDefault();

              if (e.shiftKey) {
                onResize(
                  index,
                  Math.max(5, Math.min(100 - element.position_x, element.width + move[0])),
                  Math.max(5, Math.min(100 - element.position_y, element.height + move[1]))
                );
              } else {
                onMove(
                  index,
                  Math.max(0, Math.min(100 - element.width, element.position_x + move[0])),
                  Math.max(0, Math.min(100 - element.height, element.position_y + move[1]))
                );
              }
            }}
            aria-label={`${labels[element.element_type as SlideElementType]} element. Arrow keys move it, shift and arrow keys resize it.`}
            aria-pressed={isSelected}
            className={`absolute flex flex-col items-start justify-start gap-0.5 overflow-hidden rounded-lg border-2 p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 ${
              ELEMENT_TONE[element.element_type] ?? ELEMENT_TONE.text
            } ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
            style={{
              left: `${element.position_x}%`,
              top: `${element.position_y}%`,
              width: `${element.width}%`,
              height: `${element.height}%`,
              cursor: dragging?.index === index ? 'grabbing' : 'grab',
            }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
              {labels[element.element_type as SlideElementType]}
              {element.points > 0 ? ` · ${element.points}` : ''}
            </span>
            <span className="line-clamp-3 text-[11px] leading-tight">
              {summarise(element)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One line telling the author which element this box is, at a glance. */
function summarise(element: SlideElementInput): string {
  const text = element.content_text.replace(/<[^>]*>/g, '').trim();
  if (text !== '') return text;

  switch (element.element_type) {
    case 'image':
    case 'video':
    case 'audio':
      return element.media_path ? element.media_alt || 'File attached' : 'No file yet';
    case 'blanks':
      return String(element.options?.passage ?? '') || 'No passage yet';
    case 'drag_drop':
      return element.ref_content_id ? `Activity #${element.ref_content_id}` : 'No activity chosen';
    case 'goto_slide':
      return element.options?.target_slide_ref ? 'Navigation button' : 'No destination yet';
    default:
      return 'No question yet';
  }
}
