# Study deck player

The student's native, interactive version of a chapter's generated classroom presentation.
Route: `/student/study-deck/<chapterId>` (add `?source=pilot` to read a local review copy).

## What it is, and what it is not

- It is a **presentation player**, not a web page. It fills the screen (a slim header, the slide, and a footer with
  **Previous** and **Continue** that are always in view) and **nothing on it scrolls**. The slide is drawn on a fixed design
  canvas (1280 x 720 on a wide screen, a narrow flexible one on a tall screen such as a phone) that is scaled to fit; if a
  screen's content cannot fit at full size the text is stepped down (never below 60%) rather than overflowing.
- A slide is shown **one screen at a time**, in the order a teacher would take it (`lib/study-deck/stage.ts`):
  1. **Teach**: title, explanation and the large visual, with its hotspots, scenario or cards.
  2. **Example**: the worked example, and the common mistake as a "not quite / instead" comparison.
  3. **Discuss**: the question for the class, the possible answer behind a button, framed as Think - Pair - Share.
  A slide with no example or discussion is one screen.
- The first screen's **composition comes from the slide's own data** (`layoutOf`), the same data the PPT is built from:
  cover (chapter + topics), image + text, a diagram with hotspots, a decision, discovery cards, a three-card explanation,
  a statement with the concept's neighbours, a connection between two ideas (cause-and-effect style), a chapter map.
  Timelines and charts are not drawn yet: this chapter has no dated events or data to draw, so the generator does not produce
  them. Adding them means a new diagram layout in `DiagramRenderer` and a layout here.
- The **outline is a drawer** opened from the header, not a sidebar; **practice is a dialog** opened from the header.
  Both are windows the learner opens over the lesson and are the only places that may scroll.
- It **does not open the PPTX**. The PPTX/PDF stay the static classroom presentation of the same lesson; the player is the
  interactive version of it.
- **No H5P row is created, no question row is changed, nothing is written to the database or to storage.**
  Interactions are plain data in the deck; practice questions are played by the repository's own in-memory runtime
  (`lib/h5p/question-bank-runtime.ts`).
- **Questions are optional practice, not the lesson.** They never appear on a slide; a "Practice" button in the header opens
  the existing native question player over it. Nothing asks for an answer before the learner can continue.
- Keyboard: left and right arrows move through the lesson, Escape closes the drawer or dialog.

## Every learning slide is interactive

The generator (stage 3, `InteractionPlanner`) writes one interaction for every learning slide, chosen by what the slide is, and says
why. A slide that comes back plain gets a second, firmer ask before it is left plain, and the validator lists any that still are.
Nothing is scored: an interaction teaches, reveals, compares or connects, and the learner explores it at their own pace.

| Kind | What the learner does | Chosen when |
|---|---|---|
| **hotspots** | Selects the numbered parts of a drawn diagram; the camera eases toward the part, a compact card opens over the slide, the part is marked explored. | The slide has a drawn diagram. The pipeline knows where each label sits (`DiagramRenderer::anchors`), so the picture and its hotspots cannot disagree. |
| **reveal** | Cards: select one and its explanation replaces the panel beside it. | A set of 2 to 5 ideas (parts, kinds, reasons, objectives). |
| **steps** | A process along a line: open each step, with "Next step". | A sequence of 3 to 5 steps. |
| **compare** | Two or three things side by side, each opened, then a line on how they compare. | Contrasting ideas (law and theory, two models). |
| **timeline** | Dated events along an axis, each opened. | The chapter text gives real dates (this chapter has none). |
| **scenario** | A situation, a decision, what happens and why, then the next decision or a conclusion; step back, try a different path. | A real decision or cause and effect. At most 3 per deck. |
| **match** | Pick a term, then the meaning that fits; a wrong try says "not that one". | Vocabulary the chapter defines. At most 2. |
| **order** | Choose what comes next to build a real sequence; a wrong try says "not yet". | A sequence worth arranging. At most 2. |

The worked example, the common mistake and the key idea are interactive too: the **example screen** is a set of cards (Worked example,
Common mistake, Instead), each opening its content in the panel beside them, and the **Key idea** card unlocks once the others have been opened.
The discussion screen keeps the possible answer behind a button.

While an interaction is open the footer says what to do ("Open all 4 cards to continue."); Continue is never disabled, it just stops being the
highlighted button until the screen is explored, and the screen says "All ideas explored ✓". What the learner has opened on a screen is kept while the
lesson is open, so going to the next screen and back does not wipe it.

Reuse: the hotspot pin is the existing H5P image-hotspots marker (`app/h5p/h5p_image_hotspots/components/marker.tsx`) and "explored" is the same coverage
rule the H5P module scores with (`scoreHotspotVisit`). The H5P module's own hotspot player is database-backed, so it is not embedded; nothing of H5P's
storage is used. H5P Impressive Presentation was used as a design reference only (no runtime): the camera-style focus on a diagram, a screen that eases in
from the side the learner is travelling toward, and content revealed in stages. All motion is small, never moves content outward (so the fit logic
cannot mistake it for overflow) and is switched off for `prefers-reduced-motion`.

Every slide without a practice question also carries a **discussion prompt** ("Talk about it") with a possible answer behind a button. It is not
marked.

## Data

| Piece | Where it comes from |
|---|---|
| Deck (slides, concept map, image paths, interactions, discussion prompts, activity specs) | `POST /api/lms-study-deck` - the JSON sidecar stored beside the presentation file (`<filename>.deck.json`). Pilot: `public/study-deck/chapter-<id>/deck.json`. |
| Practice questions | `POST /api/lms-question-bank`, the same rows every other module plays. The deck holds question **ids**, never question text. |

The contract is pinned by a golden file: `next_lms_erp/tests/Fixtures/study-deck-golden.json`
(written by `StudyDeckContractFixtureTest`), copied to `lib/study-deck/fixtures/`. The player tests
load that exact file; it carries one slide of each interaction kind and plays every practice question through the real runtime.
Deck version is **3**.

## Practice (optional)

The deck asks for a target; `resolveActivity` (`lib/study-deck/deck.ts`) checks it against the real
row with `mapQuestionToPlayerPayload` and falls back to the question's own default target if the row
cannot be that type. Playable targets: `single_choice_set`, `true_false`, `fill_in_the_blanks`,
`drag_text`, `mark_the_words`, `memory_game`, `flashcards`, `essay`, `course_presentation`, `drag_drop`.
The questions stay mounted once opened, so folding the section away never loses an answer in progress.

## Progress

`lib/study-deck/progress.ts`: a pure reducer plus best-effort `localStorage`, keyed per learner and
chapter. **No LMS attempt/progress API exists for study content**, so progress stays in the browser and
the page says so. A slide is complete once it is opened and its interaction (if any) is explored; the chapter
percentage counts slides and interactions. **Practice never holds anything up**: it is tracked and shown in the
summary but a learner who skips it has still finished. Back and Continue are never blocked.

## What an answer writes

The player itself writes nothing: no database row, no storage, no H5P record. The exploration (hotspots, scenario,
reveal, discussion) sends nothing anywhere. But the shared H5P players the optional practice embeds
(`components/h5p/players`) send best-effort learning telemetry as a learner answers
(`postH5pXapiStatement` -> `POST /api/pal/h5p/xapi`), exactly as they do in every other module. The PAL
pipeline stores those as `TelemetryEvent` / `LearningEvent` / `LearningEvidence` rows for that learner. That
is existing behaviour, deliberately left in place, and it is why the page tells the learner that answers are
recorded as learning activity. It now only happens for the few practice questions a learner chooses to open.

## Known limits

- Progress is not visible to teachers and does not follow the learner to another device.
- `/api/lms-question-bank` is not tenant-scoped (see `question-bank-library.ts`); the deck inherits that.
- Hotspots exist only on drawn diagrams. A found photograph cannot carry them: nothing can see where its parts are.
- The entry is a "Study lesson" card on the student chapter content view (`components/study-deck/StudyDeckEntry.tsx`);
  it shows only when a stored deck exists for the chapter (it asks the same read endpoint, and shows nothing on a 404).
- The logic is covered by `lib/study-deck/*.test.ts`. The components were exercised in real Chrome (desktop and a 390px
  phone width) against the real deck and real bank rows with every API call intercepted; those Playwright scripts are not
  in the repo.
- The player covers the app shell, so the shell's own header and sidebar are not shown while a lesson is open; **Exit** returns to the page the learner came from.
- In development the Next.js dev badge sits in the bottom-left corner over the Previous button; it does not exist in a production build.
