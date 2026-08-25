# Generative AI field assistant

A sparkle icon beside an editable field. Click it, describe the change in plain language
or pick a suggested action, review the result, apply it. The existing form save flow is
untouched.

---

## 1. Architecture

```
 Form field (any of 24 files)
   │  value + context
   ▼
 <AiFieldAssistant>                    components/ai/AiFieldAssistant.tsx
   │  POST /api/ai/field-edit
   ▼
 Route handler                         app/api/ai/field-edit/route.ts
   │  zod validation → guards
   ▼
 Prompt builder                        lib/ai/field-edit/prompt.ts
   │  system rules + field-type guidance + context
   ▼
 createAiModel()                       packages/conversational-ai-core/src/model.ts
   │  gemini-2.5-flash
   ▼
 Clean + inspect output                lib/ai/field-edit/prompt.ts
   │
   ▼
 { result, note, actionKey, model }  →  preview  →  user presses Apply  →  onApply()
```

**Nothing is written by the AI.** The route reads a value and returns a suggestion. The
form's own save path persists it, and only after a human presses Apply and then Save. An
AI failure cannot corrupt a record on its own.

---

## 2. Files

### New

| File | Purpose |
|---|---|
| `components/ai/AiFieldAssistant.tsx` | The shared trigger + popover. The only UI file. |
| `app/api/ai/field-edit/route.ts` | POST endpoint. Validation, guards, model call, error envelope. |
| `lib/ai/field-edit/types.ts` | Request/response/context contract. |
| `lib/ai/field-edit/actions.ts` | Action catalogue + per-field-type suggestion registry. |
| `lib/ai/field-edit/prompt.ts` | System prompt, prompt builder, output cleaning and inspection. |
| `docs/AI_FIELD_ASSISTANT.md` | This document. |

### Modified — 24 files, 32 assistant instances

Three of these are **shared renderers**, so they cover many screens each:
`components/result/DynamicForm.tsx`, `app/general/_components/GeneralPage.tsx`,
`app/hostel/_components/HostelModulePage.tsx`.

---

## 3. Implementation map

| # | Module | Page / screen | Form | Field | Field type | Suggested actions | Frontend file |
|---|---|---|---|---|---|---|---|
| 1 | LMS | Homework | Create homework | Description | `instructions` | Simplify · Be specific · Bullets · Shorter · For grade · Grammar · Translate | `app/lms/homework/page.tsx` |
| 2 | LMS | Assignment | Create assignment | Description (max 50) | `description` | Improve · Shorter · Longer · Simplify · Specific · Engaging · Grammar · Translate | `app/lms/lmsAssignment/page.tsx` |
| 3 | LMS | Online exam | Exam settings | Description | `instructions` | Simplify · Specific · Bullets · Shorter · For grade · Grammar · Translate | `app/lms/exam/page.tsx` |
| 4 | LMS | Syllabus plan | Add/edit plan | Objectives | `learning_objective` | Specific · Improve · Bullets · For grade · Shorter · Grammar | `app/lms/syllabus-plan/page.tsx` |
| 5 | LMS | Syllabus plan | Add/edit plan | Learning outcomes | `learning_objective` | as above | same |
| 6 | LMS | Syllabus plan | Add/edit plan | Suggested materials | `description` | Improve · Shorter · Longer · Simplify · Specific · Engaging | same |
| 7 | LMS | Syllabus plan | Add/edit plan | Assessment plan | `instructions` | Simplify · Specific · Bullets · Shorter · For grade | same |
| 8 | Course master | Lesson plan | Lesson plan draft | Learning objectives | `learning_objective` | Specific · Improve · Bullets · For grade · Shorter · Grammar | `app/course-master/lesson-plan/[courseId]/page.tsx` |
| 9 | Course master | Chapter question bank | Add question | Question text | `question` | **Improve question** · Simplify · Specific · **Change difficulty** · **For grade** · **Similar question** · Grammar · Translate | `app/course-master/[courseId]/chapters/page.tsx` |
| 10 | Course master | Chapter question bank | Add question | Model answer | `explanation` | Simplify · Improve · Add details · For grade · Bullets · Shorter | same |
| 11 | Course master | Chapters | Add/edit chapter | Chapter description | `description` | Improve · Shorter · Longer · Simplify · Specific · Engaging | same |
| 12 | Exam | Exam creation | Create paper | Description | `description` | as above | `app/exam/exam-creation/page.tsx` |
| 13 | Quiz | Create quiz | Question builder | Question text (per question) | `question` | Improve question · Simplify · Specific · Change difficulty · For grade · Similar · Grammar · Translate | `app/quiz/create/page.tsx` |
| 14 | H5P | Flashcards — create | Card | Question | `question` | as #13 | `app/h5p/h5p_flashacard/create/page.tsx` |
| 15 | H5P | Flashcards — create | Card | Content / explanation | `explanation` | Simplify · Improve · Add details · For grade · Bullets | same |
| 16 | H5P | Flashcards — edit | Card | Question | `question` | as #13 | `app/h5p/h5p_flashacard/[id]/edit/page.tsx` |
| 17 | H5P | Flashcards — edit | Card | Content / explanation | `explanation` | as #15 | same |
| 18 | H5P | Scenario — create | Hotspot modal | Description | `lesson_content` | Improve · Simplify · For grade · Add details · Bullets · Engaging | `app/h5p/scenario_based/create/page.tsx` |
| 19 | H5P | Scenario — edit | Hotspot modal | Description | `lesson_content` | as #18 | `app/h5p/scenario_based/[id]/edit/page.tsx` |
| 20 | PAL | Content authoring | Author content | Body | `lesson_content` | as #18 | `app/pal/new/content-model/authoring/page.tsx` |
| 21 | Easy Com | Communication | Send message | Message | `announcement` | Improve · **More formal** · Shorter · **For parents** · Simplify · Grammar · Translate | `app/easy_com/_components/EntryPage.tsx` |
| 22 | Institute detail | Policies | Add/edit policy | Description | `policy` | **More formal** · Improve · Specific · Bullets · Add details · Grammar | `app/Institute_Detail/Department/Component/polices.tsx` |
| 23 | Institute detail | Rules | Add/edit rule | Rule logic / description | `policy` | as #22 | `app/Institute_Detail/Department/Component/rules.tsx` |
| 24 | General | Add process | Add process | Process steps | `instructions` | Simplify · Specific · Bullets · Shorter · For grade | `app/general/add_process/AddProcessPage.tsx` |
| 25 | General | Onboarding | Step drawer | Notes (max 5000) | `notes` | Improve · Bullets · Shorter · Grammar | `app/general/onboarding/_components/StepDrawer.tsx` |
| 26 | General | **All general modules** | Any config form | Every `textarea` / `editor` field | `description` / `announcement` | per type | `app/general/_components/GeneralPage.tsx` |
| 27 | Hostel | **All hostel modules** | Any setup form | Every `textarea` field | `description` | Improve · Shorter · Longer · Simplify · Specific | `app/hostel/_components/HostelModulePage.tsx` |
| 28 | Result | **All dynamic result forms** | Any form | Every writable `textarea` | `description` | as above | `components/result/DynamicForm.tsx` |
| 29 | Library | Book resources | Add/edit resource | Custom textarea fields | `description` | as above | `app/library/book_resources/page.tsx` |
| 30 | Student | Student care | Care record | Any `textarea` care field | `feedback` | Improve · **For parents** · Specific · Shorter · Simplify · Grammar | `app/student/_components/StudentCareModule.tsx` |
| 31 | Admissions | Admission enquiry | Enquiry modal | Remarks *(uncontrolled → `targetId`)* | `notes` | Improve · Bullets · Shorter · Grammar | `app/admissions/admission_enquiry/page.tsx` |

---

## 4. Deliberate exclusions

The brief says not to add the icon everywhere. These were reviewed and left out:

| Area | Why |
|---|---|
| Inventory — PO, quotation, direct purchase, receivable, requisition (7 files) | Transactional. Remarks on a purchase order are a record, not content. |
| Fees — collect, cancel/refund, other fees, circular remarks, config master | Money. Rewriting a fee remark risks altering the record of a transaction. |
| Marks entry (exam + result), student attendance | Numeric data entry. |
| Petty cash, PTM attended status, inward/outward register | Ledger entries. |
| Address fields — add user, admission enquiry, admission registration, admission-Enquiry | Factual. An AI must never "improve" an address. |
| Visitor purpose (add-visitor) | Short factual log entry. |
| SQAA document titles | Identifiers, not prose. |
| `CreateTab`, `RecommendationCard`, `ai-generation-drawer`, `policy-generation-dialog` | Already AI surfaces. |
| `JsonPreviewPanel`, `LayersPanel`, `components/ui/textarea.tsx` | Debug/JSON/primitive. |

---

## 5. Not yet wired — remaining backlog

Legitimate content targets not reached in this pass. Each needs the same three-line
change; the pattern is in §7.

| File | Field | Suggested type | Note |
|---|---|---|---|
| `app/lms/curriculum-planning/page.tsx` | Learning objectives | `learning_objective` | Uncontrolled — needs an `id`, then `targetId` mode |
| `app/lms/monthly-plan/page.tsx` | Learning objectives | `learning_objective` | Uncontrolled |
| `app/lms/lesson-plan/page.tsx` | Learning objectives, Notes | `learning_objective`, `notes` | Uncontrolled |
| `app/lms/book-list/page.tsx` | Description | `description` | |
| `app/lms/leader-board-master/page.tsx` | Description | `description` | |
| `app/lms/homework/submission/page.tsx` | Teacher remark | `feedback` | |
| `app/lms/lmsAnnotate_assignment/[id]/page.tsx` | Annotation | `feedback` | |
| `app/h5p/h5p_interactive_video/create` + `[id]/edit` | Interaction text | `lesson_content` | |
| `app/pal/new/gamification/team-challenges/page.tsx` | Challenge description | `description` | |
| `app/pal/new/_components/AdministrationPanels.tsx` | Panel description | `description` | |
| `app/front_desk/_components/GalleryAlbums.tsx` | Album description | `description` | Uses `{...common}` spread — needs unpacking |
| `app/front_desk/_components/ModuleWorkbench.tsx` | Module textareas | `description` | Shared renderer — high leverage |
| `app/general/_components/TemplateHtmlEditor.tsx` | Template HTML | `announcement` | Rich text |
| `app/general/form_builder/FormBuilderEditor.tsx` | Field help text | `description` | |
| `app/document-templates/editor/[templateId]/page.tsx` | TipTap blocks | `announcement` | Rich text — needs editor-aware apply |
| `app/Institute_Detail/Institute_profile/page.tsx` | Profile description | `description` | |
| `app/students/search_student/components/StudentDetailDrawer.tsx` | Remarks | `notes` | |
| `app/chapters/page.tsx` | Quick notes | `notes` | Scratch pad — low value |
| `app/sqaa/_components/EntryPage.tsx` | Document title | `title` | Marginal |

---

## 6. Suggested actions by field type

Defined in `lib/ai/field-edit/actions.ts`. Order is a product decision — the first few
are what people actually click.

| Field type | Actions, in order |
|---|---|
| `question` | Improve question · Simplify · Be specific · Change difficulty · Rewrite for a grade · Generate similar · Fix grammar · Translate |
| `answer_option` | Improve · Shorter · Specific · Grammar · Similar · Translate |
| `explanation` | Simplify · Improve · Add details · For grade · Bullets · Shorter · Grammar · Translate |
| `learning_objective` | Be specific · Improve · Bullets · For grade · Shorter · Grammar |
| `lesson_content` | Improve · Simplify · For grade · Add details · Bullets · Engaging · Shorter · Grammar · Translate |
| `instructions` | Simplify · Specific · Bullets · Shorter · For grade · Grammar · Translate |
| `description` | Improve · Shorter · Longer · Simplify · Specific · Engaging · Grammar · Translate |
| `announcement` | Improve · More formal · Shorter · For parents · Simplify · Grammar · Translate |
| `policy` | More formal · Improve · Specific · Bullets · Add details · Grammar |
| `feedback` | Improve · For parents · Specific · Shorter · Simplify · Grammar |
| `summary` / `title` / `notes` / `generic` | Sensible subsets |

**Empty field** → the list collapses to *Draft from the title* and *Generate a better
version*. You cannot shorten nothing, so no dead chips are shown.

Actions requiring input (`Translate`, `Rewrite for a grade`, `Change difficulty`) ask a
follow-up question rather than guessing.

---

## 7. Adding the assistant to a new field

Controlled field:

```tsx
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';

<div className="flex items-center justify-between">
  <Label htmlFor="desc">Description</Label>
  <AiFieldAssistant
    value={description}
    onApply={setDescription}
    fieldType="description"
    label="Course description"
    module="course-master"
    page="Courses"
    entityType="course"
    grade={standardName}      // optional but strongly recommended
    subject={subjectName}
    related={{ Title: title }} // sibling context, reference only
    maxLength={500}            // if the field caps
  />
</div>
<Textarea id="desc" value={description} onChange={...} />
```

Uncontrolled field (`defaultValue`, no state):

```tsx
<AiFieldAssistant targetId="remarks" fieldType="notes" label="Remarks" />
<textarea id="remarks" defaultValue={record.remarks} />
```

`targetId` writes through the element's native value setter and dispatches `input`, so
React `onChange` still fires. It is safe for controlled fields too.

---

## 8. API contract

**`POST /api/ai/field-edit`**

```jsonc
{
  "value": "Photosynthesis is the process by which green plants make food.",
  "instruction": "Make this easier for Grade 5 students.",   // or:
  "actionKey": "simplify",
  "actionInput": "Hindi",                                     // for translate/grade/difficulty
  "context": {
    "fieldType": "lesson_content",
    "fieldLabel": "Lesson content",
    "module": "lms",
    "page": "Lesson plan",
    "entityType": "lesson_plan",
    "entityId": 42,
    "grade": "Grade 5",
    "subject": "Science",
    "language": "English",
    "related": { "Chapter title": "Plants and food" },
    "maxLength": 500
  }
}
```

Success `200`:

```json
{
  "result": "Photosynthesis is how green plants make their own food.",
  "actionKey": "simplify",
  "model": "gemini-2.5-flash",
  "note": "No change was needed — the text already meets that instruction."
}
```

Failures — same envelope as `app/api/ai/chat`:

| Status | `code` | When |
|---|---|---|
| 422 | `AI_FIELD_EDIT_INVALID` | Schema failure, or neither instruction nor action |
| 422 | `AI_FIELD_EDIT_UNKNOWN_ACTION` | `actionKey` not in the catalogue |
| 422 | `AI_FIELD_EDIT_NO_CONTENT` | Empty field with no context to draft from |
| 422 | `AI_FIELD_EDIT_UNUSABLE` | Model replied with a refusal, or 20× runaway expansion |
| 429 | `AI_QUOTA_EXCEEDED` | Provider quota — includes `Retry-After` |
| 500 | `AI_FIELD_EDIT_FAILED` | Anything else |

---

## 9. Prompt and guardrails

`lib/ai/field-edit/prompt.ts`. Rules given to the model, in priority order:

1. Return **only** the replacement text — no preamble, no fences. This text goes
   straight into a field a teacher saves.
2. **Never invent facts** — no new date, time, venue, name, amount, mark or citation.
   The most damaging failure in school content is a plausible fabrication, because it
   looks like the rest of the text and nobody re-reads a field they only asked to shorten.
3. Follow the instruction **exactly** — "fix grammar" must not also reword.
4. Keep the original language unless asked to translate.
5. Keep the formatting shape (HTML in → HTML out).
6. Content is read by children — no profanity, scare tactics, stereotyping or emoji.
7. If already correct, return unchanged rather than inventing a difference.

Plus per-field-type guidance — a `question` is told to keep one thing being asked and
never include the answer; `feedback` is told to describe work and behaviour, never the
child's character.

**Post-processing** (`cleanFieldEditOutput`, `inspectFieldEditOutput`): strips a fence or
conversational opener wrapping the whole answer; rejects refusals returned as content and
20× runaway expansion.

---

## 10. Configuration

No new environment variables. Uses the existing key already in `.env.local`:

```
GEMINI_API_KEY=...          # or GOOGLE_GENERATIVE_AI_API_KEY
GEMINI_MODEL=gemini-2.5-flash   # optional override
```

Same `createAiModel()` factory as `app/api/ai/chat`.

---

## 11. Testing checklist

### A. Endpoint (no UI needed)

```bash
curl -s -X POST http://localhost:3000/api/ai/field-edit \
  -H "Content-Type: application/json" \
  -d '{"value":"Photosynthesis is the process by which green plants make food.",
       "instruction":"Make this easier for Grade 5 students.",
       "context":{"fieldType":"lesson_content","grade":"Grade 5","subject":"Science"}}'
```

| Test | Expect |
|---|---|
| Above | Simplified sentence, no preamble |
| `"actionKey":"improve_question"` on `"What is water?"` | A sharper question |
| `"actionKey":"translate","actionInput":"Hindi"` | Devanagari output |
| `"value":"","instruction":"make it better"`, no context | 422 `AI_FIELD_EDIT_NO_CONTENT` |
| `"actionKey":"nope"` | 422 `AI_FIELD_EDIT_UNKNOWN_ACTION` |
| No instruction and no action | 422 `AI_FIELD_EDIT_INVALID` |

### B. Page-by-page

| Page | How to reach the form | Field with icon | Expected chips | Try this | Expect |
|---|---|---|---|---|---|
| **Quiz → Create quiz** | `/quiz/create` | Question text (each question) | Improve question, Change difficulty, Generate similar | "Make this suitable for Class 8" | Reworded question, options still fit |
| **LMS → Homework** | `/lms/homework` → search students | Description | Simplify, Bullets, For grade | "Convert this into bullet points" | Bulleted list |
| **LMS → Assignment** | `/lms/lmsAssignment` → search | Description | Improve, Shorter | "Make this shorter" | ≤ 50 chars respected |
| **LMS → Syllabus plan** | `/lms/syllabus-plan` → Add | Objectives / Outcomes / Materials / Assessment | Be specific, Bullets | "Make these measurable" | Verb-led objectives |
| **LMS → Online exam** | `/lms/exam` → create paper | Description | Simplify, Translate | "Translate into Hindi" | Devanagari |
| **Course master → Chapters** | `/course-master/[id]/chapters` → Add question | Question text, Model answer | Improve question / Simplify | "Make the answer easier for Grade 5" | Simplified answer, question unchanged |
| **Course master → Lesson plan** | `/course-master/lesson-plan/[id]` | Learning objectives | Be specific, For grade | "Make these measurable" | Observable verbs |
| **Exam → Exam creation** | `/exam/exam-creation` | Description | Improve, Shorter | "Improve the grammar" | Grammar only, wording kept |
| **H5P → Flashcards** | `/h5p/h5p_flashacard/create` | Question, Content | Improve question / Simplify | "Make this more engaging" | Livelier, still factual |
| **H5P → Scenario** | `/h5p/scenario_based/create` → add hotspot | Description | Improve, For grade | "Simplify the language" | Simpler |
| **PAL → Content authoring** | `/pal/new/content-model/authoring` | Body | Improve, Add details | "Add more details" | Expanded, no invented facts |
| **Easy Com** | `/easy_com` → compose | Message | More formal, For parents | "Reword this for parents" | Jargon-free |
| **Institute → Policies** | Department → Policies → Add | Description | More formal first | "Make this more formal" | Formal register |
| **Institute → Rules** | Department → Rules → Add | Rule logic | More formal | "Convert into bullet points" | Bulleted rules |
| **General → Add process** | `/general/add_process` | Process | Simplify, Bullets | "Number these steps" | Ordered steps |
| **General → any module** | any `/general/*` config form | any textarea field | Improve, Shorter | "Improve writing" | Cleaner text |
| **Hostel → any module** | any hostel setup form | any textarea | Improve, Simplify | "Make this shorter" | Shorter |
| **Result → any dynamic form** | any result entry form | any writable textarea | Improve, Shorter | "Fix spelling & grammar" | Corrections only |
| **Library → Book resources** | `/library/book_resources` → Add | Custom textarea | Improve, Longer | "Add more details" | Expanded |
| **Student → Student care** | `/student` → Care → Add | any textarea | **For parents**, Be specific | "Reword this for parents" | Plain, blame-free |
| **Admissions → Enquiry** | `/admissions/admission_enquiry` → Add/Edit | Remarks *(uncontrolled)* | Improve, Bullets | "Improve the grammar" | Applies into the field |

### C. Behaviour, on any field

| Check | Expect |
|---|---|
| Click icon | Popover opens, cursor in "How would you like to edit this?" |
| Chips shown | Match the field type — a question field shows *Improve question*, a policy field leads with *More formal* |
| Empty field | Only *Draft from the title* / *Generate a better version* |
| Type + Enter | Runs (Shift+Enter = newline) |
| Click **Translate** | Asks "Into which language?" before running |
| **Apply** | Field updates, popover closes, "Undo AI edit" appears |
| **Undo AI edit** | Original text restored |
| **Cancel** | Field unchanged |
| **Regenerate** | Re-runs the same instruction |
| **New instruction** | Back to the chip list |
| Edit the preview | Editable before applying |
| Save the form | Existing save works exactly as before |
| Close mid-request | Request aborts, no state left behind |

### D. Regression

- Every wired form still saves correctly **without** touching the assistant.
- Validation, required fields and `maxLength` behave as before.
- `npx tsc --noEmit` → clean. `npm run build` → compiles.
