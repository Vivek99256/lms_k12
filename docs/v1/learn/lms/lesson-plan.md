# Lesson Plan
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/lesson-plan` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST /intelligence/lesson-plans`, `GET/POST /intelligence/lesson-plan-detail`, `POST /intelligence/lesson-plan-periods`, `POST /intelligence/lesson-plan-periods/{id}/update`, `POST /intelligence/lesson-plan-periods/{id}/delete`, `GET/POST /lesson-plan-doc`, `POST /lesson-plan-doc/save` |
| Roles | Teacher (create/edit, requires `perm:lms.content,create`), Admin (view all) |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Teachers use Lesson Plan to create and manage individual lesson entries mapped to subject → chapter → period. Each lesson plan records the topic, learning objectives, outcome mapping, suggested materials, assessment plan, and progress tracking notes. Used in day-to-day teaching preparation.

Two related but distinct systems exist:
1. **Lesson Plan Doc** — a structured rich-text lesson plan document per period (`lesson-plan-doc` API).
2. **Intelligence Lesson Plans** — an AI-assisted macro/meso/micro planning hierarchy (`intelligence/lesson-plans` API).

## 2. Screens

### Lesson Plan list — `/lms/lesson-plan`
Shows: filter bar (section, standard, division, subject, chapter), list of lesson plans with period, topic, and date.
Main actions: create new lesson plan, edit existing, delete.
![](./screenshots/lesson-plan-list.png)

### Lesson Plan detail / editor
Shows: form with class filters, chapter picker, period picker, objective/outcome/materials/assessment/progress fields.
Main actions: save, delete.
![](./screenshots/lesson-plan-editor.png)

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Section / Standard / Division | Dropdown (SearchDropdown) | Yes | Must match enrolled classes for teacher | — |
| Subject | Dropdown | Yes | Filtered by standard | — |
| Chapter | Dropdown | Yes | Loaded via `/intelligence/lesson-plan-lookup/chapters` | — |
| Period | Dropdown | Yes | Loaded via `/intelligence/lesson-plan-lookup/periods` | — |
| Title | Text | Yes | Non-empty | — |
| Objectives | Textarea | No | — | — |
| Learning Outcomes | Textarea | No | — | — |
| Suggested Materials | Textarea | No | — | — |
| Assessment Plan | Textarea | No | — | — |
| Progress Tracking | Textarea | No | — | — |

Permission rules:
- Read: any authenticated staff with `lms.auth`.
- Create/edit: requires `perm:lms.content,create`.
- `RequireStaff` guard applied at page level.

## 4. User flows

**Happy path — create lesson plan:**
1. Teacher opens `/lms/lesson-plan`.
2. Selects section → standard → division → subject.
3. Chapter dropdown loads from `/intelligence/lesson-plan-lookup/chapters`.
4. Period dropdown loads from `/intelligence/lesson-plan-lookup/periods`.
5. Fills title, objectives, outcomes, materials, assessment, progress.
6. Clicks save → `POST /lesson-plan-doc/save` (requires `perm:lms.content,create`).
7. Entry appears in list.

**AI field assist:** `AiFieldAssistant` component is embedded in the form — teacher can get AI suggestions for objectives, outcomes, or materials fields.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_lesson_plan` | `id`, `sub_institute_id`, `syear`, `standard_id`, `subject_id`, `chapter_id`, `period_id`, `teacher_id`, `title`, `objectives`, `learning_outcomes`, `suggested_materials`, `assessment_plan`, `progress_tracking`, `created_at` | Main lesson plan rows |
| `lms_lessonplan_dayswise` | `lessonplan_id`, `day`, `period_id`, `topic` | Day-wise breakdown |
| `chapter_master` | `chapter_id`, `chapter_name`, `subject_id` | Chapter lookup |
| `period_details` | `period_id`, `title`, `short_name` | Period lookup |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET/POST | `/intelligence/lesson-plans` | JWT + `lms.auth` | `{ sub_institute_id, syear, standard_id, subject_id }` | List of lesson plan rows |
| GET/POST | `/intelligence/lesson-plan-detail` | JWT + `lms.auth` | `{ plan_id }` | Full lesson plan with period rows |
| GET/POST | `/intelligence/lesson-plan-lookup/chapters` | JWT | `{ sub_institute_id, syear, standard_id, subject_id }` | `[{ chapter_id, chapter_name }]` |
| GET/POST | `/intelligence/lesson-plan-lookup/periods` | JWT | `{ sub_institute_id }` | `[{ period_id, title, short_name }]` |
| GET/POST | `/lesson-plan-doc` | JWT + `lms.auth` | lookup params | Lesson plan document |
| POST | `/lesson-plan-doc/save` | JWT + `lms.auth` + `perm:lms.content,create` | full form body | `{ success, data }` |
| POST | `/intelligence/lesson-plan-periods` | JWT + `lms.auth` + `perm:lms.content,create` | period form body | created row |
| POST | `/intelligence/lesson-plan-periods/{id}/update` | JWT + `lms.auth` + `perm:lms.content,create` | updated fields | updated row |
| POST | `/intelligence/lesson-plan-periods/{id}/delete` | JWT + `lms.auth` + `perm:lms.content,create` | — | `{ success }` |

## 7. UI components & design tokens
- `SearchDropdown` with `classPickerFields: ['section', 'standard', 'division']`
- `AiFieldAssistant` — AI suggestion widget on objectives/outcomes/materials fields
- `RequireStaff` — staff-only page guard
- `useLmsSessionContext`, `createAuthHeaders` — session helpers
- Lucide icons: `BookOpen`, `CalendarDays`, `ChevronDown`, `Clock`, `FileText`, `Filter`, `Link2`, `Pencil`, `Plus`, `User`, `X`
- `RecordTable` component for lesson plan list display

## 8. Reports & exports
See [../reports.md](./reports.md) — Lesson plan coverage is part of the LMS Reports page (syllabus completion, lessons delivered).

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| LP-01 | Create lesson plan | Select class, subject, chapter, period; fill title; save | Plan appears in list | Happy |
| LP-02 | Student cannot access | Log in as student, navigate `/lms/lesson-plan` | Redirect (RequireStaff) | Negative |
| LP-03 | Missing permission | Teacher without `perm:lms.content,create` saves | 403 error shown | Edge |
| LP-04 | Chapter dropdown loads | Select standard + subject | Chapter options populate | Happy |
| LP-05 | AI assist | Click AI assist on objectives field | Suggestion text pre-fills field | Happy |
| LP-06 | Delete lesson plan period | Open plan, delete a period row | Row removed, list refreshes | Happy |

## 10. Known issues, limitations & FAQs
- Two lesson plan systems (`lesson-plan-doc` and `intelligence/lesson-plans`) may confuse developers; they serve different UX flows but share some underlying tables.
- `AiFieldAssistant` requires an AI provider key to be configured; without it the AI button silently fails.

## 11. Sales notes
- **Selling point**: AI-assisted lesson planning — teachers get suggested objectives and outcomes in one click.
- **Demo flow**: (1) Select class + subject; (2) pick chapter; (3) click AI assist on "Objectives" — show suggestion appearing; (4) edit and save; (5) show plan in list.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Create, edit, delete, AI assist all functional.
- v2: Macro/meso/micro planning hierarchy UI (backend APIs already exist: `LessonIntelligenceApiController`); calendar view of lesson plans; share with HOD for approval.

## Source files
- `C:\rajesh\lms_k12\app\lms\lesson-plan\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (intelligence/lesson-plan-* routes)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\IntelligenceLessonPlanApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\LessonPlanDocumentApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\LessonPlanDocumentWriteApiController.php`
