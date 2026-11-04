# PAL — Mastery Tracking

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/mastery/chapter/[chapterId]/page.tsx`

---

## Purpose

The Mastery Tracking screen shows concept-level mastery for one learner within a single chapter. It is the primary diagnostic view for a teacher reviewing a student's progress and for a student reviewing their own plan.

---

## Dual-Store Design

Mastery is tracked in two parallel stores:

| Store | Table | What it holds |
|---|---|---|
| BKT store | `pal_concept_mastery` | Bayesian Knowledge Tracing probability (0–1) per learner × concept |
| Engine store | `learner_node_state` | Concept stage, attempt counts, next recommended action |

The page reads both stores and displays them together. The two stores are intentionally separate: BKT is a statistical estimate; the engine state is the operational record.

---

## Concept Stages

Each concept has one of the following stages (shown as coloured chips on the screen):

| Stage | Chip colour | Meaning |
|---|---|---|
| `retained` | Green (deep) | Mastered and confirmed in recall review |
| `mastered` | Green | BKT probability above mastery threshold |
| `recall_due` | Amber | Mastered but recall review is overdue |
| `awaiting_mastery_check` | Blue | Engine queued a mastery check; awaiting attempt |
| `in_progress` | Indigo | Active practice or diagnostic in progress |
| `not_started` | Grey | No attempts recorded |
| `no_questions` | Grey (muted) | No questions exist in the estate for this concept |

---

## Completed Chapters

When all concepts in a chapter reach `mastered` or `retained`, the chapter is marked complete. Completed chapters become **read-only** in the mastery view — no further practice is served by default unless a teacher or the learner manually re-opens it.

---

## Actions from This Screen

| Action | Available to |
|---|---|
| Open concept diagnostic | Student (own), Teacher (via "view as") |
| Open recall review | Student (own), Teacher (via "view as") |
| Reset a concept (re-attempt) | Teacher, Admin |

---

## Role Gate

- **Student** sees their own mastery only.
- **Teacher** can enter "view as student" mode via `StudentPicker` + `ViewAsBanner` to review any learner in their section.
- The role is resolved from `isStudentSession()` in `app/pal/data/pal-lookups.ts`; persisted view choice uses `pal-view-as.ts`.

---

## Source Files

- `app/pal/mastery/chapter/[chapterId]/page.tsx`
- `app/pal/data/pal-lookups.ts`
- `app/pal/data/pal-view-as.ts`
- `app/pal/_components/StudentPicker.tsx`
- `app/pal/_components/ViewAsBanner.tsx`
