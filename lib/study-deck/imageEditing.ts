import type { DeckImage, DeckSlide, ExploreItem, ItemsInteraction, ScenarioInteraction, StudyDeck } from './types';

/**
 * Editing the pictures of a slide-based lesson, independent of where the lesson is kept.
 *
 * Any player that can show a lesson for editing supplies an ADAPTER (the calls to its own storage: a draft waiting for review today); the
 * dialog, the buttons and the rules for what is shown are shared. A format keeps its pictures in its own place, so the thing being edited
 * is a TARGET: a slide's picture, one scene of a story, or one item of a slide whose items are opened one at a time beside its picture. The
 * adapter's server decides what may be done; this file only carries the answer to the screen.
 */

/** One picture of a lesson: a slide's, or (with `node`) one scene of a story slide, or (with `item`) one item of an items slide. */
export interface ImageTarget {
  slide: number;
  node?: string;
  item?: string;
}

/**
 * The interactions whose items the player opens beside the slide's picture, where the open item's own picture is drawn. The server applies the
 * same rule (StoredDeckImageEditor::hasItemPictures), so a slide offered here is one the server will accept item pictures for.
 */
const ITEM_KINDS: readonly string[] = ['reveal', 'steps', 'timeline', 'compare'];

/** The items of a slide that can each carry a picture of their own, or null when the slide keeps one picture for all of it. */
export function pictureItemsOf(slide: { interaction?: DeckSlide['interaction']; image?: unknown }): ExploreItem[] | null {
  const interaction = slide.interaction;
  if (!interaction || !ITEM_KINDS.includes(interaction.kind) || !slide.image) return null;
  const items = (interaction as ItemsInteraction).items;

  return Array.isArray(items) && items.length > 0 ? items : null;
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
  /** What is on the slide now: a real photograph, a drawn diagram, or nothing. Sent for a stored presentation. */
  kind?: 'photo' | 'diagram' | 'none';
  /** A scene's name. */
  title?: string;
  /** For a story slide: the same, per scene. */
  nodes?: Record<string, ImageEditState>;
  /** For a slide whose items open beside its picture: the same, per item. */
  items?: Record<string, ImageEditState>;
}

export type ImageEditStates = Record<string, ImageEditState>;

export type ImageAction = 'add' | 'replace' | 'remove' | 'restore';

export interface ImageEditResult {
  slide: number;
  node: string | null;
  /** The item whose picture changed, when it was an item's. */
  item?: string | null;
  action: ImageAction;
  /** The picture now (with an address the browser can load), or null when there is none. */
  image: DeckImage | null;
  can_restore: boolean;
  state: Omit<ImageEditState, 'nodes' | 'items' | 'title' | 'can_restore'> & { can_restore?: boolean };
}

export interface ImageCandidate {
  id: string;
  thumbnail_url: string;
  title: string;
  creator: string | null;
  licence: string;
  provider: string;
  source_url: string;
  /** Size in pixels, when the source said. */
  width?: number;
  height?: number;
  /** The search words this picture's own title, tags or categories share: why it was listed. */
  matches?: string[];
}

export interface ImageSearch {
  query: string;
  candidates: ImageCandidate[];
  /** Why there is nothing to choose from (search down, nothing openly licensed), or null. */
  note: string | null;
  /** One-click alternatives to the default words: the slide's planned picture, its title, its concept. */
  suggestions?: { label: string; query: string }[];
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
  if (target.item !== undefined) return slide.items?.[target.item] ?? null;
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

/**
 * The accessible name of an item's control. It names the item because the slide's own "Change image" is on screen too, and two buttons with the
 * same name cannot be told apart by a screen reader. It starts with the visible words, as a name should.
 */
export function itemOpenLabel(state: ImageEditState | null, name: string): string {
  return `${state?.has_image ? 'Change image' : 'Add image'} for ${name}`;
}

/**
 * What to tell the teacher after a change. A stored presentation is saved at once; a draft is saved when it is approved. `subject` names an
 * item or a scene in words a teacher knows (its label), instead of the id the server uses.
 */
export function actionSentence(result: Pick<ImageEditResult, 'action' | 'slide' | 'node'> & { item?: string | null }, stored = false, subject?: string): string {
  const where = result.item ? `Slide ${result.slide}, “${subject ?? result.item}”` : result.node ? `Slide ${result.slide}, scene ${subject ?? result.node}` : `Slide ${result.slide}`;
  const kept = stored ? 'The change is saved with this presentation.' : 'It is part of this draft and is saved when you approve it.';
  switch (result.action) {
    case 'add':
      return `${where}: picture added. ${kept}`;
    case 'replace':
      return `${where}: picture replaced. ${kept}`;
    case 'remove':
      return `${where}: picture removed. You can restore the original.`;
    case 'restore':
      return `${where}: the original is back.${stored ? ' The change is saved with this presentation.' : ''}`;
  }
}

/**
 * The deck with ONE picture changed: a slide's, a scene's inside its story slide, or an item's inside its items slide. Everything else (every
 * other slide, scene and item, the text, the choices and links, the interaction) is the very same object as before.
 */
export function withEditedImage(deck: StudyDeck, result: Pick<ImageEditResult, 'slide' | 'node' | 'image'> & { item?: string | null }): StudyDeck {
  return {
    ...deck,
    slides: deck.slides.map((s) => {
      if (s.n !== result.slide) return s;
      if (result.item != null) {
        const items = pictureItemsOf(s);
        if (!items) return s;
        // An item with no picture left (restored to how it began) carries none, and the slide's picture shows for it again.
        const edited = items.map((item) => (item.id === result.item ? (result.image ? { ...item, image: result.image } : { ...item, image: null }) : item));

        return { ...s, interaction: { ...(s.interaction as ItemsInteraction), items: edited } };
      }
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
export function withEditedState(states: ImageEditStates, result: Pick<ImageEditResult, 'slide' | 'node' | 'state' | 'can_restore'> & { item?: string | null }): ImageEditStates {
  const key = String(result.slide);
  const slide = states[key];
  if (!slide) return states;
  const next = { has_image: result.state.has_image, can_add: result.state.can_add, can_replace: result.state.can_replace, can_remove: result.state.can_remove, reason: result.state.reason, can_restore: result.can_restore, ...(result.state.kind ? { kind: result.state.kind } : {}) };
  if (result.item != null) {
    const item = slide.items?.[result.item];
    if (!item) return states;

    return { ...states, [key]: { ...slide, items: { ...slide.items, [result.item]: { ...item, ...next } } } };
  }
  if (result.node == null) return { ...states, [key]: { ...slide, ...next } };
  const node = slide.nodes?.[result.node];
  if (!node) return states;
  return { ...states, [key]: { ...slide, nodes: { ...slide.nodes, [result.node]: { ...node, ...next } } } };
}
