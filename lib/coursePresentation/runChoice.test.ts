import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CoursePresentationFlow } from '../../components/coursePresentation/CoursePresentationFlow';
import { GenerationPanel } from '../../components/coursePresentation/GenerationPanel';
import type { CpFit, CpRun } from './api';
import { coverageSentence, runForChoice, runMatchesChoice, storedHeading } from './runChoice';
import { carriesEarlierChoice, readCpState, startState, withCpState } from './urlState';

const OLD_STORY = 'r4e06dfcb0625';
const NEW_STORY = 'r2e8122b2ee27';
const SLIDES_RUN = 'r0a1b2c3d4e5f';

const SLIDES = { pedagogy: 'inquiry_based', format: 'interactive_slides' };
const STORY = { pedagogy: 'experiential', format: 'branching_scenario' };

const run = (id: string, choice: { pedagogy: string; format: string }, over: Partial<CpRun> = {}): CpRun =>
  ({
    run: id,
    state: 'ready',
    method: choice.pedagogy,
    format: choice.format,
    created_at: '2026-10-21T11:17:50+05:30',
    progress: [],
    error: null,
    report: { slides: 11, interactive_slides: 9, concepts: 32, warnings: 2, method_followed: true },
    coverage: { checked: true, source_concepts: 32, taught: 32, missing: [] },
    outline: null,
    images: null,
    stored: null,
    ...over,
  }) as unknown as CpRun;

const panel = (choice: { pedagogy: string; format: string }, initialRun: CpRun | null, fit: Partial<CpFit> = {}) =>
  renderToStaticMarkup(
    createElement(GenerationPanel, {
      chapterId: 8592,
      pedagogy: choice.pedagogy,
      format: choice.format,
      fit: { viewer_type: 'study_deck', generation_supported: true, generation_blockers: [], ...fit } as unknown as CpFit,
      initialRun,
      onOpenPresentation: () => {},
    }),
  );

// ---------------------------------------------------------------------------------------------------------------------
// Which run belongs to which choice

test('a run belongs only to the teaching method and format it was made for', () => {
  const story = run(NEW_STORY, STORY);
  assert.equal(runMatchesChoice(story, STORY.pedagogy, STORY.format), true);
  assert.equal(runMatchesChoice(story, SLIDES.pedagogy, SLIDES.format), false, 'another format');
  assert.equal(runMatchesChoice(story, 'inquiry_based', STORY.format), false, 'another teaching method');
  assert.equal(runMatchesChoice(story, STORY.pedagogy, 'interactive_slides'), false);
});

test('a run recorded without a format counts as an interactive-slides run', () => {
  const legacy = { method: 'inquiry_based' } as Pick<CpRun, 'method'>;
  assert.equal(runMatchesChoice(legacy, 'inquiry_based', 'interactive_slides'), true);
  assert.equal(runMatchesChoice(legacy, 'inquiry_based', 'branching_scenario'), false);
});

test('runForChoice never offers a draft of another choice, nor a discarded one', () => {
  assert.equal(runForChoice(run(NEW_STORY, STORY), SLIDES.pedagogy, SLIDES.format), null);
  assert.equal(runForChoice(run(SLIDES_RUN, SLIDES), STORY.pedagogy, STORY.format), null);
  assert.equal(runForChoice(run(NEW_STORY, STORY, { state: 'discarded' }), STORY.pedagogy, STORY.format), null);
  assert.equal(runForChoice(null, STORY.pedagogy, STORY.format), null);
  assert.equal(runForChoice(run(NEW_STORY, STORY), STORY.pedagogy, STORY.format)?.run, NEW_STORY);
});

// ---------------------------------------------------------------------------------------------------------------------
// What the panel shows follows the selection, never a run left over from another one

test('choosing PowerPoint shows the presentation draft and never the story draft', () => {
  const html = panel(SLIDES, run(SLIDES_RUN, SLIDES));
  assert.ok(html.includes(SLIDES_RUN), 'its own draft is offered');
  assert.ok(html.includes('Open the draft in the study-deck player'));
  assert.ok(!html.includes('Play the story draft'));
  assert.ok(!html.includes('story lesson'));
});

test('choosing Branching Scenario shows the story draft and never the presentation draft', () => {
  const html = panel(STORY, run(NEW_STORY, STORY));
  assert.ok(html.includes(NEW_STORY));
  assert.ok(html.includes('Play the story draft in the study-deck player'));
  assert.ok(html.includes('I have reviewed this story lesson'));
  assert.ok(!html.includes('Open the draft in the study-deck player'));
});

test('switching format never shows the previous format\'s draft: the panel offers to create instead', () => {
  // The server answered with the story draft while PowerPoint is chosen (a stale or wrong answer).
  const showsSlides = panel(SLIDES, run(NEW_STORY, STORY));
  assert.ok(showsSlides.includes('data-run-state="none"'));
  assert.ok(!showsSlides.includes(NEW_STORY) && !showsSlides.includes('Play the story draft') && !showsSlides.includes('cp-approve'));
  assert.ok(showsSlides.includes('cp-generate'), 'the create state is shown');

  const showsStory = panel(STORY, run(SLIDES_RUN, SLIDES));
  assert.ok(showsStory.includes('data-run-state="none"'));
  assert.ok(!showsStory.includes(SLIDES_RUN) && !showsStory.includes('cp-approve'));
  assert.ok(showsStory.includes('cp-generate'));
});

test('a stale run id cannot override the current selection: the newer run of the same choice is the one shown', () => {
  const stale = panel(STORY, run(OLD_STORY, STORY));
  const fresh = panel(STORY, run(NEW_STORY, STORY));
  assert.ok(stale.includes(OLD_STORY) && !stale.includes(NEW_STORY));
  assert.ok(fresh.includes(NEW_STORY) && !fresh.includes(OLD_STORY));
});

test('the draft says how much of the chapter\'s own concept list it teaches, and never claims what was not checked', () => {
  const verified = panel(STORY, run(NEW_STORY, STORY));
  assert.ok(verified.includes('data-verified="yes"'));
  assert.ok(verified.includes('all 32 concepts of this chapter'));

  const unchecked = panel(STORY, run(NEW_STORY, STORY, { coverage: { checked: false, source_concepts: null, taught: 32, missing: [] } }));
  assert.ok(unchecked.includes('data-verified="no"'));
  assert.ok(unchecked.includes('could not be checked'));
  assert.ok(!unchecked.includes('all 32 concepts of this chapter'), 'not verified is never presented as verified');

  const none = panel(STORY, run(NEW_STORY, STORY, { coverage: null }));
  assert.ok(none.includes('could not be checked'));
});

test('coverageSentence names a concept the draft misses', () => {
  const s = coverageSentence({ checked: true, source_concepts: 32, taught: 31, missing: ['Mole'] }, 32);
  assert.equal(s.verified, true);
  assert.ok(s.text.includes('31 of the chapter\'s 32') && s.text.includes('Mole'));
});

test('what is already stored is headed by the chosen format', () => {
  assert.equal(storedHeading('interactive_slides'), 'Presentations already stored');
  assert.equal(storedHeading('branching_scenario'), 'Story lessons already stored');
  assert.notEqual(storedHeading('video_lesson'), storedHeading('interactive_slides'));
});

// ---------------------------------------------------------------------------------------------------------------------
// The selection form appears every time the flow is opened

const flow = (initial: ReturnType<typeof readCpState>) =>
  renderToStaticMarkup(
    createElement(CoursePresentationFlow, {
      chapterId: 8592,
      initial,
      onMirror: () => {},
      onClose: () => {},
      onOpenPresentation: () => {},
      onOpenPreview: () => {},
    }),
  );

test('opening the flow always shows the teaching method and content format form', () => {
  const html = flow(startState());
  assert.ok(html.includes('Plan the Course Presentation'));
  assert.ok(html.includes('How should I teach?'));
  assert.ok(html.includes('What should students experience?') || html.includes('legend'), 'the format choice is part of the form');
  assert.ok(!html.includes('What this chapter has'), 'the pre-flight screen is not shown');
  assert.ok(!html.includes('checked'), 'nothing is pre-selected');
});

test('an address that carries an earlier choice and the pre-flight screen still opens the empty form', () => {
  // A reload, Back or a copied link: cpOpen=1&cpPedagogy=experiential&cpFormat=branching_scenario&cpStage=preflight
  const fromAddress = readCpState(new URLSearchParams('cpOpen=1&cpPedagogy=experiential&cpFormat=branching_scenario&cpStage=preflight'));
  assert.equal(fromAddress.stage, 'preflight', 'the address does carry the old screen');
  assert.equal(carriesEarlierChoice(fromAddress), true);

  const html = flow(fromAddress);
  assert.ok(html.includes('Plan the Course Presentation'), 'the form is shown, not the pre-flight');
  assert.ok(!html.includes('What this chapter has'));
  assert.ok(!html.includes('cp-generation'), 'no draft, no run, no create panel from the earlier choice');
  assert.ok(!html.includes('checked'), 'the earlier choice is not pre-selected');
});

test('reopening starts from an empty form every time', () => {
  const first = startState();
  const second = startState();
  assert.deepEqual(first, { open: true, pedagogy: null, format: null, stage: 'choose' });
  assert.notEqual(first, second, 'a fresh object each time, never shared state');
  assert.equal(carriesEarlierChoice(first), false);
  // What the address holds once the form is open and nothing is chosen carries no choice.
  assert.equal(carriesEarlierChoice(readCpState(withCpState(new URLSearchParams(), first))), false);
});
