# H5P — Content Types

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/h5p/*/page.tsx`, `app/h5p/data/h5p.ts`

---

## Overview

H5P (HTML5 Package) is Scholar Learn's interactive content player. It delivers 17 content types across a consistent player shell. Each content type has its own Next.js route under `app/h5p/`. Content is scoped by an H5P context (standard, chapter, subject) passed via URL query params.

---

## Context Model

Every H5P player reads an `H5pContext` from URL search params via `readH5pContext()` in `app/h5p/data/h5p.ts`. The context provides:

| Field | Purpose |
|---|---|
| `standard_id` / `standard_name` | Class / grade |
| `chapter_id` / `chapter_name` | Chapter scope |
| `subject_id` / `subject_name` | Subject scope |

If context is missing, the player shows a `MissingContextNotice` component and does not load questions.

---

## xAPI Tracking

All content types post xAPI statements via `postH5pXapiStatement()`. This records verb (`answered`, `completed`, `attempted`) and success state for each interaction. xAPI data feeds into PAL reports and the LMS gradebook.

---

## 17 Content Types

| # | Type | Route | Description |
|---|---|---|---|
| 1 | Multiple Choice Questions (MCQ) | `/h5p/h5p_mcq` | Difficulty-level picker → one-at-a-time quiz player → results + printable certificate |
| 2 | Fill in the Blanks | `/h5p/fill_blanks` | Cloze-style questions |
| 3 | Drag and Drop | `/h5p/drag_drop` | Drag items to target zones |
| 4 | Drag Text | `/h5p/drag_text` | Drag text fragments into correct positions |
| 5 | True / False | `/h5p/true_false` | Binary true/false questions |
| 6 | Single Choice Set | `/h5p/single_choice_set` | One correct option per question (simpler than MCQ) |
| 7 | Arithmetic Quiz | `/h5p/arithmetic_quiz` | Maths computation drills |
| 8 | Memory Game | `/h5p/memory_game` | Card matching game |
| 9 | Image Hotspots | `/h5p/image_hotspot` | Click on labelled regions of an image |
| 10 | Course Presentation | `/h5p/course_presentation` | Slide-based multimedia presentation |
| 11 | Branching Scenario | `/h5p/branching_scenario` | Decision-tree narrative with branched outcomes |
| 12 | Interactive Video | `/h5p/interactive_video` | Video with embedded questions at time-coded points |
| 13 | Flashcard | `/h5p/flashcard` | Front/back card review |
| 14 | Mark the Words | `/h5p/mark_the_words` | Highlight correct words in a passage |
| 15 | Scenario-based | `/h5p/scenario_based` | Contextual scenario questions |
| 16 | HTML Content | `/h5p/html_contents` | Rich HTML authoring (entry point for many types) |
| 17 | 3D Model | `/h5p/3d_model` | 3D object viewer |

---

## MCQ Detail (most complex type)

The MCQ player (`app/h5p/h5p_mcq/page.tsx`) has three stages:

### Stage 1 — Level picker
- Shows difficulty levels from `fetchMcqIndex(ctx)`
- Two sources: "By level" (legacy `mcq_levels` estate) or "From the question bank" (`lms_question_master`)
- Source toggle only on the picker — cannot switch mid-quiz

### Stage 2 — Quiz player
- One question at a time, left/right keyboard navigation
- Stats row: total / attempted / remaining
- Progress rail
- xAPI statement posted on each answer

### Stage 3 — Results + certificate
- Score circle with colour bands: ≥80% green, ≥60% amber, ≥40% teal, <40% red
- Review answers modal (correct/incorrect per question)
- Printable certificate: student name, school name/logo, score, date
- Certificate copy from `getCertificateMessage()` bands (90/75/60/40 thresholds)

---

## Shared Components

| Component | Purpose |
|---|---|
| `H5pPageHeader` | Title, description, back link, context display |
| `MissingContextNotice` | Shown when URL context is absent |
| `InlineBanner` | Error/info banners within the player |
| `LoadingState` | Spinner with label |
| `EmptyState` | Empty content notice |
| `ProgressRail` | Linear progress bar |
| `QuestionBankSource` | Renders questions drawn from `lms_question_master` |

Source: `app/h5p/components/shared.tsx`, `app/h5p/components/game.tsx`

---

## Source Files

- `app/h5p/h5p_mcq/page.tsx` — MCQ player (most detailed)
- `app/h5p/data/h5p.ts` — context parsing, fetch functions, xAPI
- `app/h5p/components/shared.tsx`
- `app/h5p/components/game.tsx`
- Laravel: `app/Http/Controllers/H5PMCQController.php` and sibling controllers
