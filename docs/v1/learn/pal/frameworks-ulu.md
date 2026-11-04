# PAL — Frameworks & ULU

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source: `app/pal/` route scan; detailed source files for frameworks/ULU not read.

---

## Overview

PAL content is tagged against two types of frameworks:

1. **Learning Frameworks** — Bloom's Taxonomy, NCERT curriculum alignment, subject competency standards
2. **ULU (Universal Learning Units)** — atomic learning units that form the base of concept authoring

---

## ULU (Universal Learning Unit)

A ULU is the smallest authored unit in the PAL content estate. Each concept maps to one or more ULUs. A ULU contains:

- A learning objective
- One or more question items (across the four content types)
- Misconception tags
- Framework alignment tags (Bloom level, curriculum strand)

ULUs are authored in the Laravel backend and consumed read-only by the Next.js frontend.

---

## Bloom's Taxonomy Alignment

The content model uses Bloom's six cognitive levels:

| Level | Verb examples |
|---|---|
| Remember | Recall, identify, list |
| Understand | Explain, summarise, classify |
| Apply | Use, solve, demonstrate |
| Analyse | Compare, differentiate, examine |
| Evaluate | Judge, justify, critique |
| Create | Design, construct, produce |

Bloom vocabulary for tagging is loaded via `fetchVocabulary()` in the Content Model workspace.

---

## NCERT / Curriculum Alignment

Each ULU and question can be tagged to:
- NCERT chapter and topic
- State board curriculum strand (where applicable)
- Competency code

Exact tag schema: TBD — defined in backend migrations.

---

## Framework Admin Routes

| Route | Purpose |
|---|---|
| `/pal/new/content-model` | View and manage framework tagging in the authoring workspace |

Additional framework admin routes: TBD — not confirmed in page scan.

---

## Source Files

- `app/pal/new/content-model/page.tsx` (vocabulary fetch, Bloom ladder display)
- Backend: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\PAL\` (TBD exact controller)
