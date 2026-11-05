# PAL — Content Model

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/new/content-model/page.tsx`

---

## Purpose

The Content Model workspace is the authoring and quality-management surface for the PAL content estate. It is used by curriculum designers and AI content teams to track coverage, review quality, and manage the full lifecycle of PAL content.

---

## Four-Type Content Model

PAL content is organised into four types. Each type maps to a distinct pedagogical role:

| Type | Role |
|---|---|
| Type 1 | TBD (name not in source) |
| Type 2 | TBD |
| Type 3 | TBD |
| Type 4 | TBD |

The overview screen shows a coverage tile for each type with counts sourced from `fetchEstateCoverage()`.

---

## Bloom Ladder

The Content Model workspace displays a Bloom's Taxonomy ladder with vocabulary sourced from `fetchVocabulary()`. This vocabulary is used to tag questions and content items to cognitive level.

---

## Indian Cultural Contexts

The workspace includes an Indian cultural contexts section. These are contextual frames used to ground question scenarios in culturally relevant settings. Source: `fetchVocabulary()`.

---

## Language Variants

Content can be authored in multiple language variants. The workspace tracks language coverage per concept and chapter.

---

## Authoring Pipeline

| Quality Status | Meaning |
|---|---|
| `draft` | Initial creation, not yet reviewed |
| `review` | Submitted for quality review |
| `approved` | Cleared for learner delivery |
| `rejected` | Returned to author |

The pipeline statuses are displayed per chapter/concept in the workspace.

---

## Chapter Picker

The workspace includes a chapter picker with:
- Grade filter
- Subject filter
- Chapter list (sourced from `fetchChapters()`)

This picker scopes all coverage and quality views to the selected chapter.

---

## Key API Calls

| Function | Purpose |
|---|---|
| `fetchEstateCoverage()` | Returns counts: chapters, concepts, questions, AI availability, type coverage |
| `fetchVocabulary()` | Returns Bloom ladder vocabulary and cultural context tags |
| `fetchChapters()` | Returns chapters filtered by grade and subject |

---

## Source Files

- `app/pal/new/content-model/page.tsx`
- `app/pal/data/` (fetch functions)
