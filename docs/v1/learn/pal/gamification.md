# PAL — Gamification

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/new/gamification/page.tsx`

---

## Purpose

The Gamification system motivates sustained learning engagement. It is privacy-first: students see only their own data plus anonymous class aggregates — no individual peer comparisons are exposed.

---

## Mastery Tiers

| Tier | Name | Trigger |
|---|---|---|
| 1 | Stream | TBD |
| 2 | Mountain | TBD |
| 3 | Sky | TBD |

Tiers are earned by reaching mastery thresholds across concepts. Exact threshold values: TBD (not in page source; defined in backend engine configuration).

---

## Streak

A streak counts consecutive **days of real engagement** — not calendar days. A day qualifies if the learner completes at least one diagnostic or adaptive practice session. The streak counter is displayed on the student's gamification overview.

---

## Badges

Badges are aligned to three external frameworks:

| Framework | Description |
|---|---|
| HPC (High Performance Competencies) | Achievement-oriented behaviours |
| CASEL (Social & Emotional Learning) | Social-emotional competencies |
| NCDG (National Career Development Guidelines) | Career-readiness indicators |

Each badge maps to a specific framework competency. Badges are awarded by the backend engine when a learner demonstrates the associated behaviour pattern.

---

## Career Quest

Career Quest uses the **RIASEC model** (Holland's interest types: Realistic, Investigative, Artistic, Social, Enterprising, Conventional). As learners earn badges and progress through mastery tiers, their RIASEC profile updates, linking academic progress to career interest alignment.

The Career Quest is surfaced in Scholar Compass for counsellors. The PAL gamification page shows the current RIASEC state.

---

## Challenge Mode

Challenge mode is **opt-in**. A learner can activate it to receive harder questions and a time-boxed challenge sequence. The mode is not imposed by the engine.

---

## Team Challenges

Team challenges are **teacher-initiated**. A teacher can create a team challenge for a section or group. Students in the group see the shared challenge goal and progress. The challenge ends when the goal is met or the deadline passes.

---

## Personal Bests

Personal bests track a learner's highest scores on individual concepts or chapters. They are visible only to the learner themselves.

---

## Privacy Model

| Data | Visible to student | Visible to teacher |
|---|---|---|
| Own tier / streak / badges | Yes | Yes (for their students) |
| Anonymous class aggregates | Yes | Yes |
| Peer individual data | No | Yes (aggregated only) |

---

## Source Files

- `app/pal/new/gamification/page.tsx`
