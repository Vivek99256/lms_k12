# PAL — Overview

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/new/page.tsx`, `app/pal/data/pal*.ts`

---

## What is PAL?

PAL (Personalised Adaptive Learning) is Scholar Learn's core adaptive engine. It delivers personalised practice sequences to K–12 learners, tracks mastery concept-by-concept via Bayesian Knowledge Tracing (BKT), surfaces learning gaps, and escalates cases the engine cannot resolve to the teacher.

---

## Sub-modules

| Sub-module | Route | Purpose |
|---|---|---|
| PAL Estate Overview | `/pal/new` | Coverage stats across the content estate |
| Content Model | `/pal/new/content-model` | Authoring workspace: four-type model, quality pipeline |
| Coherence Map | `/pal/new/coherence-map` | Concept prerequisite graph per class+subject |
| Gamification | `/pal/new/gamification` | Mastery tiers, streaks, badges, career quest |
| Pedagogy Engine | `/pal/pedagogy-engine` | Engine configuration and rule viewer |
| Mastery Tracking | `/pal/mastery/chapter/[chapterId]` | Per-chapter concept mastery for a learner |
| Intervention | `/pal/intervention` | Support-case queue (staff only) |
| Activity Report | `/pal/reports/activity` | Per-student diagnostic + practice report |
| Attainment Report | `/pal/reports/attainment` | TBD |

---

## Estate Coverage

The PAL overview screen (`app/pal/new/page.tsx`) fetches `fetchEstateCoverage()` and shows:

- Total chapters, concepts, and questions across the content estate
- AI availability (% of concepts with AI-generated content)
- Four-type model coverage tiles (one tile per type)
- Sub-module cards linking to deeper sections

---

## Role Gates

| Role | Access |
|---|---|
| Student | Own mastery, own activity report, own gamification data |
| Teacher | Full queue (intervention), "view as student" for any learner in their section |
| Admin / AI Admin | Full estate, pedagogy engine, coherence map |

The role is resolved from `isStudentSession()` in `app/pal/data/pal-lookups.ts`. Students see only their own data; teacher/admin roles see the full roster via `StudentPicker`.

---

## Key Data Stores

| Table | Purpose |
|---|---|
| `pal_concept_mastery` | BKT mastery probability per learner × concept |
| `learner_node_state` | Engine state: concept stage, attempt counts, next action |
| `pal_diagnostic_attempts` | Individual diagnostic question attempts |
| `pal_adaptive_attempts` | Individual adaptive practice attempts |
| `pal_intervention_cases` | Support cases (open / pending / closed) |

---

## Source Files

- `app/pal/new/page.tsx`
- `app/pal/data/pal.ts`
- `app/pal/data/pal-lookups.ts`
- `app/pal/data/pal-view-as.ts`
- `app/pal/_components/StudentPicker.tsx`
- `app/pal/_components/ViewAsBanner.tsx`
