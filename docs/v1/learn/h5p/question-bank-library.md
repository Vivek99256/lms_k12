# H5P — Question Bank & Library

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/h5p/data/h5p.ts`, `app/h5p/components/question-bank-source.tsx`

---

## Purpose

The Question Bank Library (`lms_question_master`) is the central repository of questions that can be used across multiple H5P content types. It is an alternative source to the legacy level-keyed estates (e.g., `mcq_levels`). The `QuestionBankSource` component renders questions drawn from this table in any H5P player that supports it.

---

## Question Bank vs. Legacy Levels

| Aspect | Legacy levels (e.g., `mcq_levels`) | Question bank (`lms_question_master`) |
|---|---|---|
| Keyed by | Difficulty level | Context (standard, chapter, subject) |
| Player mode | "By level" tab | "From the question bank" tab |
| Use | Original H5P estate | Unified question store |

The two estates are intentionally separate and not converted into each other (see comment in `app/h5p/h5p_mcq/page.tsx`).

---

## `lms_question_master` Table

| Column | Purpose |
|---|---|
| `id` | Question ID |
| `question_text` | HTML-encoded question body |
| `standard_id` | Class / grade scope |
| `chapter_id` | Chapter scope |
| `subject_id` | Subject scope |
| `question_type` | Maps to H5P content type (e.g., `single_choice_set`) |
| Additional columns | TBD — full schema in backend migrations |

---

## QuestionBankSource Component

`app/h5p/components/question-bank-source.tsx`

Props:
- `kind` — the H5P content type to render (e.g., `single_choice_set`)
- `ctx` — the `H5pContext` (standard, chapter, subject)
- `noun` — display label for the content type (e.g., "multiple choice question")

The component fetches questions matching the context and `kind`, then renders them in the appropriate player shell.

---

## H5P Context Helpers

From `app/h5p/data/h5p.ts`:

| Function | Purpose |
|---|---|
| `readH5pContext(params)` | Parses H5P context from URL search params |
| `hasH5pContext(ctx)` | Returns true if standard_id and chapter_id are present |
| `h5pContextQuery(ctx)` | Serialises context back to a query string for navigation links |
| `getUserIdentity()` | Reads student name and school info from `localStorage` |
| `postH5pXapiStatement(opts)` | Posts an xAPI statement to the backend |
| `fetchMcqIndex(ctx, levelId?)` | Fetches MCQ levels or questions for a level |

---

## Security

Question text from the database is rendered via `dangerouslySetInnerHTML`. All question text and answer text is sanitised with `sanitizeHtml` from `lib/security/sanitize-html` before rendering. No raw HTML is injected unsanitised.

---

## Source Files

- `app/h5p/data/h5p.ts`
- `app/h5p/components/question-bank-source.tsx`
- `lib/security/sanitize-html.ts`
- Backend: `F:\xampp\htdocs\next_lms_erp\database\migrations\*lms_question_master*`
