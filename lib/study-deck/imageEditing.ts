import type { DeckImage, ScenarioInteraction, StudyDeck } from './types';

/**
 * Editing the pictures of a slide-based lesson, independent of where the lesson is kept.
 *
 * Any player that can show a lesson for editing supplies an ADAPTER (the calls to its own storage: a draft waiting for review today); the
 * dialog, the buttons and the rules for what is shown are shared. A format keeps its pictures in its own place, so the thing being edited
 * is a TARGET: a slide's picture, or one scene of a story. The adapter's server decides what may be done; this file only carries the
 * answer to the screen.
 */

/** One picture of a lesson: a slide's, or (with `node`) one scene of a story slide. */
export interface ImageTarget {
  slide: number;
  node?: string;
}

/** What may be done with one picture, as the server decided. */
export interface ImageEditState {
  has_image: boolean;
  can_add: boolean;
  can_replace: boolean;
  can_remove: boolean;
  can_restore: boolean;
  /** Why the picture cannot be changed (pins or hotspots placed on it, a story slide), or null. */
  reason: string | null;
  /** A scene's name. */
  title?: string;
  /** For a story slide: the same, per scene. */
  nodes?: Record<string, ImageEditState>;
}

export type ImageEditStates = Record<string, ImageEditState>;

export type ImageAction = 'add' | 'replace' | 'remove' | 'restore';

export interface ImageEditResult {
  slide: number;
  node: string | null;
  action: ImageAction;
  /** The picture now (with an address the browser can load), or null when there is none. */
  image: DeckImage | null;
  can_restore: boolean;
  state: Omit<ImageEditState, 'nodes' | 'title' | 'can_restore'> & { can_restore?: boolean };
}

export interface ImageCandidate {
  id: string;
  thumbnail_url: string;
  title: string;
  creator: string | null;
  licence: string;
  provider: string;
  source_url: string;
}

export interface ImageSearch {
  query: string;
  candidates: ImageCandidate[];
  /** Why there is nothing to choose from (search down, nothing openly licensed), or null. */
  note: string | null;
}

export interface UploadOptions {
  credit?: string;
  alt?: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** The operations an editable lesson offers. Each throws an Error whose message is meant for the teacher. */
export interface ImageEditorAdapter {
  search(target: ImageTarget, query?: string, signal?: AbortSignal): Promise<ImageSearch>;
  /** Adds a picture where there is none, or replaces the one there. */
  setFromCandidate(target: ImageTarget, candidateId: string): Promise<ImageEditResult>;
  setFromUpload(target: ImageTarget, file: File, options: UploadOptions): Promise<ImageEditResult>;
  remove(target: ImageTarget): Promise<ImageEditResult>;
  restore(target: ImageTarget): Promise<ImageEditResult>;
}

/** The state of one target in the map the server sent, or null when the server named none (nothing can be done there). */
export function stateFor(states: ImageEditStates, target: ImageTarget): ImageEditState | null {
  const slide = states[String(target.slide)];
  if (!slide) return null;
  return target.node === undefined ? slide : slide.nodes?.[target.node] ?? null;
}

/** True when anything at all may be done with this picture: the button is shown disabled, with its reason, when not. */
export function canEdit(state: ImageEditState | null): boolean {
  return state !== null && (state.can_add || state.can_replace || state.can_remove || state.can_restore);
}

/** The label of the control that opens the editor: it says what will happen. */
export function openLabel(state: ImageEditState | null, scene = false): string {
  const noun = scene ? 'scene picture' : 'image';
  if (state === null) return `Change ${noun}`;
  return state.has_image ? `Change ${noun}` : `Add ${noun}`;
}

export function actionSentence(result: Pick<ImageEditResult, 'action' | 'slide' | 'node'>): string {
  const where = result.node ? `Slide ${result.slide}, scene ${result.node}` : `Slide ${result.slide}`;
  switch (result.action) {
    case 'add':
      return `${where}: picture added. It is part of this draft and is saved when you approve it.`;
    case 'replace':
      return `${where}: picture replaced. It is part of this draft and is saved when you approve it.`;
    case 'remove':
      return `${where}: picture removed. You can restore the original.`;
    case 'restore':
      return `${where}: the original is back.`;
  }
}

/**
 * The deck with ONE picture changed: a slide's, or a scene's inside its story slide. Everything else (every other slide and scene, the
 * text, the choices and links, the interaction) is the very same object as before.
 */
export function withEditedImage(deck: StudyDeck, result: Pick<ImageEditResult, 'slide' | 'node' | 'image'>): StudyDeck {
  return {
    ...deck,
    slides: deck.slides.map((s) => {
      if (s.n !== result.slide) return s;
      if (result.node == null) return { ...s, image: result.image };
      const interaction = s.interaction;
      if (!interaction || interaction.kind !== 'scenario') return s;
      const scenario = interaction as ScenarioInteraction;
      return {
        ...s,
        interaction: { ...scenario, nodes: scenario.nodes.map((n) => (n.id === result.node ? { ...n, image: result.image } : n)) },
      };
    }),
  };
}

/** The states after a change: only the changed picture's entry is replaced. */
export function withEditedState(states: ImageEditStates, result: Pick<ImageEditResult, 'slide' | 'node' | 'state' | 'can_restore'>): ImageEditStates {
  const key = String(result.slide);
  const slide = states[key];
  if (!slide) return states;
  const next = { has_image: result.state.has_image, can_add: result.state.can_add, can_replace: result.state.can_replace, can_remove: result.state.can_remove, reason: result.state.reason, can_restore: result.can_restore };
  if (result.node == null) return { ...states, [key]: { ...slide, ...next } };
  const node = slide.nodes?.[result.node];
  if (!node) return states;
  return { ...states, [key]: { ...slide, nodes: { ...slide.nodes, [result.node]: { ...node, ...next } } } };
}
