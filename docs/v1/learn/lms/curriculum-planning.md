# Curriculum Planning
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/curriculum-planning` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET/POST /intelligence/curriculum-planning`, `GET/POST /intelligence/curriculum-planning/chapter`, `GET/POST /intelligence/curriculum-outcomes`, `GET/POST /intelligence/curriculum-outcomes/outcome`, `GET/POST /intelligence/monthly-plan` |
| Roles | Teacher (view + edit with `perm:lms.content,create`), Admin, HOD |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Curriculum Planning gives teachers and HODs a structured view of what has been taught vs. planned across subjects, chapters, and months. It is the main tool for tracking syllabus execution and setting upcoming lessons.

The page has four tabs:
1. **Overview** — stats tiles + subject × month grid + upcoming lessons + subject progress.
2. **Curriculum** — the structural chapter/topic tree.
3. **CG / LO Analysis** — curriculum goal and learning outcome analysis per chapter.
4. **Lesson Plans** — lesson plans mapped to the curriculum.

## 2. Screens

### Curriculum Planning — `/lms/curriculum-planning`
Shows: Academic scope bar (section/standard/division/subject filters), tab switcher, tab content area.
Main actions: add topic, edit topic, filter syllabus, navigate to chapter, view subject progress.
![](./screenshots/curriculum-planning.png)

## 3. Features & business rules

| Field | Type | Notes |
|---|---|---|
| Academic scope bar | Dropdowns: section, standard, division, subject | Persisted via `useAcademicScope` hook |
| Overview tab | Stats + month grid + upcoming lessons list | Customisable via `useDashboardPreferences` (OVERVIEW_WIDGETS) |
| Curriculum tab | Chapter tree | Read-only structure view |
| CG/LO Analysis tab | Outcomes per chapter | Loads `/intelligence/curriculum-outcomes` |
| Lesson Plans tab | Lesson plans for chosen scope | Loads `/intelligence/lesson-plans` |
| Add Topic dialog | Modal form | Requires `perm:lms.content,create` |
| Edit Topic dialog | Modal form | Requires `perm:lms.content,create` |
| Filter Syllabus dialog | Filter modal | Read-only filter |

Permission: `RequireStaff` at page level. Write actions need `perm:lms.content,create`.

## 4. User flows

**Happy path — review syllabus coverage:**
1. Teacher opens `/lms/curriculum-planning`.
2. Selects section → standard → division → subject from scope bar.
3. API call to `/intelligence/curriculum-planning` returns overview data.
4. Overview tab shows % completion per subject and upcoming lessons.
5. Teacher clicks "Curriculum" tab → sees chapter/topic tree.
6. Teacher clicks "CG / LO Analysis" tab → sees learning outcome coverage.

**Add topic:**
1. Click "+ Add topic" button.
2. `AddTopicDialog` modal opens.
3. Fill topic details, save → `perm:lms.content,create` checked.
4. Topic appears in curriculum tree.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_curriculum` | `id`, `sub_institute_id`, `syear`, `standard_id`, `subject_id`, `chapter_id`, `curriculum_title`, `created_at` | Curriculum rows |
| `lms_syllabus` | `id`, `curriculum_id`, `title`, `objectives`, `learning_outcomes`, `suggested_materials`, `assessment_plan`, `progress_tracking` | Syllabus entries |
| `lms_units` | `id`, `syllabus_id`, `unit_name`, `sort_order` | Unit breakdown |
| `lms_learning_outcomes` | `id`, `chapter_id`, `outcome_text`, `type` | LO rows linked to chapter |
| `chapter_master` | `chapter_id`, `chapter_name`, `subject_id` | Chapter lookup |

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET/POST | `/intelligence/curriculum-planning` | JWT + `lms.auth` | Main overview data |
| GET/POST | `/intelligence/curriculum-planning/chapter` | JWT + `lms.auth` | Chapter detail |
| GET/POST | `/intelligence/curriculum-outcomes` | JWT + `lms.auth` | LO analysis list |
| GET/POST | `/intelligence/curriculum-outcomes/outcome` | JWT + `lms.auth` | Single outcome detail |
| GET/POST | `/intelligence/monthly-plan` | JWT + `lms.auth` | Monthly plan data |

## 7. UI components & design tokens
- `AcademicScopeBar` — section/standard/division/subject filter bar
- `useAcademicScope` — custom hook persisting scope selection
- `OverviewTab`, `CurriculumTab`, `OutcomesTab`, `LessonPlansTab` — tab components
- `AddTopicDialog`, `EditTopicDialog`, `FilterSyllabusDialog` — modal dialogs
- `AllUpcomingLessonsView`, `SubjectProgressDetailsView` — full-screen overlay views
- `CustomizeDashboard` with `OVERVIEW_WIDGETS`
- Lucide icons: `Filter`, `Pencil`, `Plus`
- `subjectColorAt()` — assigns consistent color per subject index

## 8. Reports & exports
LMS Reports page (`/lms/reports`) shows syllabus completion KPIs derived from this module's data.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| CP-01 | Overview loads | Select scope, open Overview tab | Stats tiles + upcoming lessons render | Happy |
| CP-02 | Tab switch | Click "Curriculum" tab | Chapter tree loads without full page reload | Happy |
| CP-03 | Add topic | Click Add, fill form, save | Topic appears in curriculum tree | Happy |
| CP-04 | No permission to add | Teacher without `perm:lms.content,create` clicks Add | 403 error | Negative |
| CP-05 | Scope change reloads data | Change subject in scope bar | All tabs update to new subject | Happy |

## 10. Known issues, limitations & FAQs
- Monthly plan tab label comment in code says "Teach/Learn → Curriculum" — this was an earlier product name; current product is Scholar Learn.
- `useAcademicScope` hook may not persist across hard refreshes if localStorage is cleared.

## 11. Sales notes
- **Selling point**: single pane shows planned vs. delivered syllabus — HOD can see at a glance which subjects are behind schedule.
- **Demo flow**: (1) Select a class + subject; (2) show Overview — highlight on-track vs. behind-schedule subjects; (3) switch to CG/LO Analysis — show outcome coverage.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. All four tabs functional.
- v2: Approval workflow for HOD to sign off syllabus plans; export syllabus completion to PDF; parent-visible curriculum progress.

## Source files
- `C:\rajesh\lms_k12\app\lms\curriculum-planning\page.tsx`
- `C:\rajesh\lms_k12\app\lms\curriculum-planning\types.ts`
- `C:\rajesh\lms_k12\app\lms\curriculum-planning\OverviewTab.tsx`
- `C:\rajesh\lms_k12\app\lms\curriculum-planning\CurriculumTab.tsx`
- `C:\rajesh\lms_k12\app\lms\curriculum-planning\OutcomesTab.tsx`
- `C:\rajesh\lms_k12\app\lms\curriculum-planning\LessonPlansTab.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\CurriculumPlanningApiController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\CurriculumOutcomesApiController.php`
