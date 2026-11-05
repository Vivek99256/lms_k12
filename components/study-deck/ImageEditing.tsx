'use client';

import { createContext, useContext } from 'react';
import { ImageIcon } from 'lucide-react';

import { canEdit, itemOpenLabel, openLabel, stateFor, type ImageEditStates, type ImageTarget } from '@/lib/study-deck/imageEditing';

/**
 * What the player is told when its lesson can be edited: which pictures may be changed (the server's answer, per slide, scene and item) and what
 * to do when the teacher asks to. A lesson that cannot be edited simply provides none of this, and no control is drawn. `slide` is the slide on
 * screen, so a story scene's or an item's button knows which slide it belongs to.
 */
export interface ImageEditing {
  states: ImageEditStates;
  slide: number;
  edit: (target: ImageTarget) => void;
}

const Context = createContext<ImageEditing | null>(null);

export const ImageEditingProvider = Context.Provider;

/** The editing the lesson offers, or null for a lesson that is only played. */
export function useImageEditing(): ImageEditing | null {
  return useContext(Context);
}

/**
 * The control that opens the editor for one picture. It says what it will do ("Add image", "Change image"), is marked unavailable (aria-disabled, so it stays focusable and still opens the window, which prints the reason) when
 * the picture cannot be changed safely, and draws nothing at all when the lesson is not being edited. It never takes part in the lesson's own
 * navigation: it is a plain button outside the slide's controls.
 *
 * `name` is the item's label, for an item's button: the slide's own button is on screen too, so the item's accessible name says whose it is.
 */
export function ImageEditButton({ target, scene = false, name, className = '' }: { target: ImageTarget; scene?: boolean; name?: string; className?: string }) {
  const editing = useImageEditing();
  if (!editing) return null;
  const state = stateFor(editing.states, target);
  // A story slide's own picture is edited scene by scene; its slide-level button would have nothing to do.
  if (state === null || (target.node === undefined && target.item === undefined && state.nodes !== undefined)) return null;
  const enabled = canEdit(state);
  const forItem = target.item !== undefined;
  const words = openLabel(state, scene);

  return (
    <button
      type="button"
      data-testid={forItem ? 'change-item-image' : target.node === undefined ? 'change-image' : 'change-scene-image'}
      onClick={() => editing.edit(target)}
      aria-disabled={!enabled || undefined}
      title={!enabled ? state.reason ?? undefined : undefined}
      aria-label={forItem ? itemOpenLabel(state, name ?? target.item ?? '') : words}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${className}`}
    >
      <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {/* An item's control sits in its own bar with room for the words; the header's and a scene's keep to an icon on a narrow screen. */}
      <span className={forItem ? '' : 'hidden sm:inline'}>{forItem ? (state.has_image ? 'Change image' : 'Add image') : words}</span>
    </button>
  );
}

/** The control for the scene on screen in a story slide; it knows the slide from the player. Draws nothing in a lesson that is only played. */
export function SceneImageButton({ node }: { node: string }) {
  const editing = useImageEditing();
  if (!editing) return null;

  return <ImageEditButton target={{ slide: editing.slide, node }} scene className="!px-[0.6em] !py-[0.25em] !text-[0.62em]" />;
}

/**
 * What an author sees on an items slide while no card is open: that every card can have a picture of its own, and how to reach the control (it
 * belongs to the open card). Without it the slide shows only the header's own button, and the per-card option looks absent until a card is opened.
 * Draws nothing in a lesson that is only played, nor on a slide the server named no item pictures for.
 */
export function ItemPictureHint({ overlay = false }: { overlay?: boolean }) {
  const editing = useImageEditing();
  if (!editing) return null;
  const items = editing.states[String(editing.slide)]?.items;
  if (!items || Object.keys(items).length === 0) return null;

  return (
    <div
      data-testid="item-picture-hint"
      className={
        overlay
          ? 'absolute left-[0.4em] top-[0.4em] z-10 rounded-[0.7em] border border-sd-line bg-white/95 px-[0.6em] py-[0.25em] text-[0.74em] text-slate-700 shadow-sm'
          : 'flex min-h-[2.7em] shrink-0 items-center gap-[0.5em] rounded-[0.7em] border border-dashed border-sd-line bg-white/70 px-[0.7em] py-[0.3em] text-[0.78em] text-slate-700'
      }
    >
      {overlay ? null : <ImageIcon className="h-[1em] w-[1em] shrink-0" aria-hidden="true" />}
      Select a card to add or change its own picture.
    </div>
  );
}

/**
 * The strip under the picture of an items slide, for the item that is open: which picture is on screen (the item's own, or the slide's because the
 * item has none) and the control that changes it. It draws nothing in a lesson that is only played, so a learner's screen is unchanged, and when
 * the editor cannot be used it still shows the control, disabled, with the reason in words, so an author is never left without it silently.
 */
export function ItemPictureBar({ item, name, hasOwn, overlay = false }: { item: string; name: string; hasOwn: boolean; overlay?: boolean }) {
  const editing = useImageEditing();
  if (!editing) return null;
  const state = stateFor(editing.states, { slide: editing.slide, item });
  if (state === null) return null;
  const enabled = canEdit(state);
  const note = !enabled && state.reason ? state.reason : hasOwn ? `Picture for ${name}.` : `${name} has no picture of its own yet, so the slide’s picture is shown.`;

  // A narrow screen has no height to spare for a strip: the control is laid over the picture's top corner instead, and the note is left to screen
  // readers. Only a reason (the control is unavailable) is shown in words, over the top of the picture, because it is what explains the control.
  if (overlay) {
    return (
      <div
        data-testid="item-picture-bar"
        className={`absolute z-10 ${enabled ? 'left-[0.4em] top-[0.4em]' : 'inset-x-[0.4em] top-[0.4em] flex items-center gap-[0.6em] rounded-[0.7em] border border-sd-line bg-white/95 p-[0.4em] text-[0.78em] text-slate-800'}`}
      >
        <p data-testid="item-picture-note" className={enabled ? 'sr-only' : 'min-w-0 flex-1'}>
          {note}
        </p>
        <ImageEditButton target={{ slide: editing.slide, item }} name={name} className="shrink-0 shadow-sm !px-[0.6em] !py-[0.2em] !text-[0.8em]" />
      </div>
    );
  }

  return (
    <div data-testid="item-picture-bar" className="flex min-h-[2.7em] shrink-0 items-center justify-between gap-x-[0.8em] rounded-[0.7em] border border-sd-line bg-white/90 px-[0.7em] py-[0.3em] text-[0.78em] text-slate-700">
      {/* One line, so the bar costs the slide as little height as possible (the explanation under it is what a small screen needs). A reason is never cut short: it is what explains a disabled control. */}
      <p data-testid="item-picture-note" title={note} className={`min-w-0 flex-1 ${enabled ? 'truncate' : ''}`}>
        {note}
      </p>
      <ImageEditButton target={{ slide: editing.slide, item }} name={name} className="shrink-0 !px-[0.7em] !py-[0.25em] !text-[1em]" />
    </div>
  );
}
