# Syllabus Plan
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/syllabus-plan` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /lms-syllabus` (list), `POST /lms-syllabus/store`, `POST /lms-syllabus/delete/{id}` — via `lmsSyllabusController`; `GET /lms-curriculum` (dropdown) — via `lmsCurriculumController` |
| Roles | Teacher (create/edit/delete, requires `RequireStaff`), Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Teachers create syllabus entries that map a curriculum to subject/standard combinations, with structured objectives, learning outcomes, suggested materials, assessment plan, and progress tracking. This is a planning tool separate from lesson-plan execution. Used at the start of term.

## 2. Screens

### Syllabus Plan list + form — `/lms/syllabus-plan`
Shows: filter bar (grade, standard, subject), `RecordTable` listing syllabus rows, inline create/edit form.
Main actions: create new syllabus entry, edit, delete.
![](./screenshots/syllabus-plan.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Grade | Dropdown | Yes | From SearchDropdown | — |
| Standard | Dropdown | Yes | From SearchDropdown | — |
| Subject | Dropdown | Yes | From SearchDropdown | — |
| Curriculum | Dropdown | Yes | Loaded via `fetchCurriculums()` | — |
| Title | Text | Yes | Non-empty | — |
| Objectives | Textarea | No | — | — |
| Learning Outcomes | Textarea | No | — | — |
| Suggested Materials | Textarea | No | — | — |
| Assessment Plan | Textarea | No | — | — |
| Progress Tracking | Textarea | No | — | — |

Delete: individual delete via `deleteSyllabus()`; `RecordTable` handles row-level delete action.
`RequireStaff` guard: students cannot access.
`AiFieldAssistant` on planning fields for AI suggestions.

## 4. User flows

**Happy path — create syllabus plan:**
1. Open `/lms/syllabus-plan`.
2. Select grade → standard → subject.
3. Curriculum dropdown loads matching options.
4. Fill title and planning fields.
5. Click save → `saveSyllabus()` → `POST /lms-syllabus/store`.
6. Entry appears in `RecordTable`.

**Delete:**
1. Click delete on row in `RecordTable`.
2. `deleteSyllabus(id)` called → row removed.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_syllabus` | `id`, `sub_institute_id`, `syear`, `standard_id`, `subject_id`, `curriculum_id`, `title`, `objectives`, `learning_outcomes`, `suggested_materials`, `assessment_plan`, `progress_tracking`, `created_at` | From `SyllabusRow` type |
| `lms_curriculum` | `id`, `title`, `standard_id`, `subject_id` | Curriculum dropdown source |

`SyllabusRow` and `CurriculumOption` types defined in `app/lms/syllabus-plan/api.ts`.

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | (TBD) | JWT | List syllabus — `fetchSyllabusList()` |
| POST | (TBD) | JWT | Save — `saveSyllabus()` |
| POST | (TBD) | JWT | Delete — `deleteSyllabus(id)` |
| GET | (TBD) | JWT | Curriculum options — `fetchCurriculums()` |

Exact routes from `lmsSyllabusController` and `lmsCurriculumController` — not visible in api.php excerpt.

## 7. UI components & design tokens
- `SearchDropdown` with grade/standard/division/subject fields
- `RecordTable` with `RecordColumn[]` — column definitions
- `AiFieldAssistant` on objectives/outcomes fields
- `RequireStaff` page guard
- Lucide icons: `AlertTriangle`, `CheckCircle2`, `Loader2`, `NotebookPen`, `Pencil`, `Plus`, `Trash2`, `X`

## 8. Reports & exports
No direct export. Syllabus data feeds into Curriculum Planning coverage reports.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| SP-01 | Create syllabus | Fill all required fields, save | Row in RecordTable | Happy |
| SP-02 | AI assist | Click AI on objectives | Suggestion pre-fills | Happy |
| SP-03 | Delete row | Click delete icon | Row removed | Happy |
| SP-04 | Missing title | Save without title | Validation error | Negative |
| SP-05 | Student access | Log in as student, navigate | Redirect (RequireStaff) | Negative |

## 10. Known issues, limitations & FAQs
- Curriculum dropdown only shows curricula matching the selected grade/standard/subject. If no curriculum exists, dropdown is empty — teacher must first create a curriculum.
- Relationship between Syllabus Plan and Curriculum Planning page is overlapping — both cover similar planning concepts from slightly different angles.

## 11. Sales notes
- **Selling point**: structured term-level syllabus planning in one click; AI fills in objectives and outcomes.
- **Demo flow**: (1) Select grade + subject; (2) AI fills objectives; (3) save; (4) show entry in list.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Create, edit, delete, AI assist functional.
- v2: Import syllabus from CSV; link syllabus entries to board/exam requirements; share with HOD for approval.

## Source files
- `C:\rajesh\lms_k12\app\lms\syllabus-plan\page.tsx`
- `C:\rajesh\lms_k12\app\lms\syllabus-plan\api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\lmsSyllabusController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\lmsCurriculumController.php`
