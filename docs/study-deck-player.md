# Study deck player

The student's native, interactive version of a chapter's generated classroom presentation.
Route: `/student/study-deck/<chapterId>` (add `?source=pilot` to read a local review copy).

## What it is, and what it is not

- It **does not open the PPTX**. It walks the deck slide by slide: explanation, picture,
  worked example, common mistake, connected concepts, then interactive activities.
- Every activity is the existing shared `QuestionPlayer` (`components/h5p/players`), asked as
  the H5P target the deck chose, reading the real question-bank row. The player shows the
  question, takes the answer, marks it, and shows the stored explanation.
- **No H5P row is created, no question row is changed, nothing is written to the database or to
  storage.** This is the repository's own in-memory runtime (`lib/h5p/question-bank-runtime.ts`);
  the deck only names which target to ask each question as.

## Data

| Piece | Where it comes from |
|---|---|
| Deck (slides, concept map, image paths, activity specs) | `POST /api/lms-study-deck` - the JSON sidecar stored beside the presentation file (`<filename>.deck.json`). Pilot: `public/study-deck/chapter-<id>/deck.json`. |
| Questions | `POST /api/lms-question-bank`, the same rows every other module plays. The deck holds question **ids**, never question text. |
| Authored checks | A slide the bank had nothing for carries one short question, bank-shaped with a negative id, played as a written answer. Never stored. |

The contract is pinned by a golden file: `next_lms_erp/tests/Fixtures/study-deck-golden.json`
(written by `StudyDeckContractFixtureTest`), copied to `lib/study-deck/fixtures/`. The player tests
load that exact file and play every activity through the real runtime.

## Activities

The deck asks for a target; `resolveActivity` (`lib/study-deck/deck.ts`) checks it against the real
row with `mapQuestionToPlayerPayload` and falls back to the question's own default target if the row
cannot be that type. Playable targets: `single_choice_set`, `true_false`, `fill_in_the_blanks`,
`drag_text`, `mark_the_words`, `memory_game`, `flashcards`, `essay`, `course_presentation`, `drag_drop`.

**Branching Scenario has no player in this platform.** A slide the planner justifies as a decision
(scenario/application slide, a choice question, a consequence to branch on) is asked as a decision
question - a single-choice activity with feedback - and is labelled "Make a decision". There is no
multi-path branching.

## Progress

`lib/study-deck/progress.ts`: a pure reducer plus best-effort `localStorage`, keyed per learner and
chapter. **No LMS attempt/progress API exists for study content**, so progress stays in the browser and
the page says so. Next step: send the same `ActivityRecord`s from `onResult` to a real endpoint; the
player does not need to change.

## What an answer writes

The player itself writes nothing: no database row, no storage, no H5P record. But the shared H5P players it
embeds (`components/h5p/players`) send best-effort learning telemetry as a learner answers
(`postH5pXapiStatement` -> `POST /api/pal/h5p/xapi`), exactly as they do in every other module. The PAL
pipeline stores those as `TelemetryEvent` / `LearningEvent` / `LearningEvidence` rows for that learner. That
is existing behaviour, deliberately left in place (it is the LMS's own activity record), and it is why the page
tells the learner that answers are recorded as learning activity. It means that once a deck is live, answering
**does** write PAL telemetry. To stop that for the deck, the telemetry call would have to be made optional in the
shared players.

## Known limits

- Progress is not visible to teachers and does not follow the learner to another device.
- `/api/lms-question-bank` is not tenant-scoped (see `question-bank-library.ts`); the deck inherits that.
- The entry is a "Study lesson" card on the student chapter content view (`components/study-deck/StudyDeckEntry.tsx`);
  it shows only when a stored deck exists for the chapter (it asks the same read endpoint, and shows nothing on a 404).
- The logic is covered by `lib/study-deck/*.test.ts`. The components were exercised in real Chrome (desktop and a 390px
  phone width) against the real deck and real bank rows with every API call intercepted; those Playwright scripts are not
  in the repo.
- On a phone the app shell's sidebar rail leaves a narrow content column (about 220px at 390px wide). The lesson fits it
  with no horizontal scroll, but long labels wrap onto several lines. That is the shell's layout, not the lesson's.
