/**
 * The inline explanation of a slide.
 *
 * A slide used to spread over up to three screens: the teaching, then a screen for the worked example and common
 * mistake, then a screen for the question to talk about. They are now ONE screen. What used to be on the extra screens,
 * and the explanation of the concept itself, sits behind an "Explain this concept" button on the slide, in a panel
 * with a tab for each thing the slide has. Nothing is generated here: every tab is the slide's own content from the
 * stored deck, and a slide with none of it has no button.
 *
 * NO REACT HERE, so every rule is testable with node:test.
 */

import { exampleCards, exampleProgress } from './interactions';
import type { LayoutKind } from './stage';
import type { DeckSlide } from './types';

export type DockTabId = 'explain' | 'example' | 'mistake' | 'talk';

export interface DockTab {
  id: DockTabId;
  label: string;
}

/**
 * Layouts whose teaching IS the explanation: a bare statement with nothing else to look at. Its explanation stays
 * on the slide itself; hiding the only thing the slide says would leave it empty.
 */
export function explanationInline(layout: LayoutKind): boolean {
  return layout === 'statement';
}

/** The concept explanations the dock shows (none when the slide already states them itself). */
export function dockExplanations(slide: DeckSlide, layout: LayoutKind): DeckSlide['content']['explanations'] {
  return explanationInline(layout) ? [] : slide.content.explanations;
}

/** The one sentence to remember, when the slide has its own. */
export function keyIdeaOf(slide: DeckSlide): string {
  return (slide.content.key_idea ?? '').trim();
}

/** The tabs of a slide's panel, in the order a teacher takes them. Empty when the slide has nothing to add. */
export function dockTabs(slide: DeckSlide, layout: LayoutKind): DockTab[] {
  if (layout === 'cover') return [];
  const c = slide.content;
  const tabs: DockTab[] = [];
  if (dockExplanations(slide, layout).length > 0 || keyIdeaOf(slide) !== '') tabs.push({ id: 'explain', label: 'Explanation' });
  if (c.example) tabs.push({ id: 'example', label: 'Worked example' });
  if (c.misconception) tabs.push({ id: 'mistake', label: 'Common mistake' });
  if (c.discussion) tabs.push({ id: 'talk', label: 'Talk about it' });

  return tabs;
}

/** What the button says: the slide's explanation when it has one, otherwise the first thing the panel holds. */
export function dockButtonLabel(tabs: readonly DockTab[]): string {
  switch (tabs[0]?.id) {
    case 'explain':
      return 'Explain this concept';
    case 'example':
      return 'See a worked example';
    case 'mistake':
      return 'See a common mistake';
    case 'talk':
      return 'Talk about it';
    default:
      return 'Learn more';
  }
}

/** The example cards a tab counts as opened (the common-mistake tab shows the mistake and what to do instead). */
export function cardsOpenedBy(tab: DockTabId): Array<'example' | 'mistake' | 'instead'> {
  if (tab === 'example') return ['example'];
  if (tab === 'mistake') return ['mistake', 'instead'];

  return [];
}

/** Has the learner opened everything the old example screen asked them to open? */
export function examplesExplored(slide: DeckSlide, seen: readonly string[]): boolean {
  return exampleProgress(slide, seen).done;
}

/** The example cards a slide has, for tests and callers that only need to know whether the slide has any. */
export function hasExampleContent(slide: DeckSlide): boolean {
  return exampleCards(slide).some((card) => card.id !== 'key');
}

export interface DockState {
  open: boolean;
  tab: DockTabId;
  /** Example cards opened so far (this is what progress reads). */
  seen: string[];
  /** Whether the discussion's possible answer is showing. */
  answer: boolean;
}

export type DockAction = { type: 'toggle' } | { type: 'tab'; tab: DockTabId } | { type: 'answer' } | { type: 'close' };

export function initialDock(tabs: readonly DockTab[]): DockState {
  return { open: false, tab: tabs[0]?.id ?? 'explain', seen: [], answer: false };
}

/** Opening a tab counts the example cards it shows as seen; opening the panel counts its first tab. */
export function dockReducer(state: DockState, action: DockAction): DockState {
  const see = (s: DockState, tab: DockTabId): DockState => {
    const add = cardsOpenedBy(tab).filter((id) => !s.seen.includes(id));

    return add.length > 0 ? { ...s, seen: [...s.seen, ...add] } : s;
  };

  switch (action.type) {
    case 'toggle':
      return state.open ? { ...state, open: false } : see({ ...state, open: true }, state.tab);
    case 'tab':
      return see({ ...state, tab: action.tab }, action.tab);
    case 'answer':
      return { ...state, answer: !state.answer };
    case 'close':
      return state.open ? { ...state, open: false } : state;
  }
}

/** The tab to show: the remembered one, or the first when that tab no longer exists. */
export function activeTab(tabs: readonly DockTab[], wanted: DockTabId): DockTabId {
  return tabs.some((tab) => tab.id === wanted) ? wanted : tabs[0]?.id ?? 'explain';
}
