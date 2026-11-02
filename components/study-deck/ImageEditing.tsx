'use client';

import { createContext, useContext } from 'react';
import { ImageIcon } from 'lucide-react';

import { canEdit, openLabel, stateFor, type ImageEditStates, type ImageTarget } from '@/lib/study-deck/imageEditing';

/**
 * What the player is told when its lesson can be edited: which pictures may be changed (the server's answer, per slide and scene) and what to do
 * when the teacher asks to. A lesson that cannot be edited simply provides none of this, and no control is drawn. `slide` is the slide on screen,
 * so a story scene's button knows which slide it belongs to.
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
 * The control that opens the editor for one picture. It says what it will do ("Add image", "Change image"), is disabled with the reason when
 * the picture cannot be changed safely, and draws nothing at all when the lesson is not being edited. It never takes part in the lesson's own
 * navigation: it is a plain button outside the slide's controls.
 */
export function ImageEditButton({ target, scene = false, className = '' }: { target: ImageTarget; scene?: boolean; className?: string }) {
  const editing = useImageEditing();
  if (!editing) return null;
  const state = stateFor(editing.states, target);
  // A story slide's own picture is edited scene by scene; its slide-level button would have nothing to do.
  if (state === null || (target.node === undefined && state.nodes !== undefined)) return null;
  const enabled = canEdit(state);

  return (
    <button
      type="button"
      data-testid={target.node === undefined ? 'change-image' : 'change-scene-image'}
      onClick={() => editing.edit(target)}
      disabled={!enabled}
      title={!enabled ? state.reason ?? undefined : undefined}
      aria-label={openLabel(state, scene)}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{openLabel(state, scene)}</span>
    </button>
  );
}

/** The control for the scene on screen in a story slide; it knows the slide from the player. Draws nothing in a lesson that is only played. */
export function SceneImageButton({ node }: { node: string }) {
  const editing = useImageEditing();
  if (!editing) return null;

  return <ImageEditButton target={{ slide: editing.slide, node }} scene className="!px-[0.6em] !py-[0.25em] !text-[0.62em]" />;
}
