# Chapter Management
**Product:** Scholar Core | **Module:** Academic Setup | **Frontend route:** `/chapters?subjectId=&standardId=` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST school_setup/chapter/create` (legacy Blade), LMS content APIs (`/api/academic-setup/…`) |
| Roles | Admin, Academic Coordinator, Teacher |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Displays and manages chapters for a given subject and standard. The `/chapters` page is the student/teacher-facing chapter viewer — it shows chapter content, PDFs, lessons and quiz. Chapter authoring (create/edit) is done through LMS curriculum planning or the backend directly.

## 2. Screens
**Chapter viewer** — `/chapters?subjectId=X&standardId=Y`
Tabs: Overview | Content | Resources | Quiz.
- Overview: chapter list, progress indicators, description.
- Content: chapter text content.
- Resources: downloadable PDF assets.
- Quiz: linked quiz for the chapter.

Shows `subjectName` in header, chapter list on left, detail on right.

![](./screenshots/chapter-view.png)

## 3. Features & business rules

| Field | Type | Notes |
|---|---|---|
| chapter_name | varchar | Chapter display name |
| chapter_desc | text nullable | Description |
| sort_order | int | Display sequence |
| availability | tinyint | Controls visibility |
| show_hide | tinyint | 1 = shown to students |
| standard_id | int FK | Scoped to standard |
| subject_id | int FK | Scoped to subject |
| syear | varchar | Academic year |

- Chapters are filtered by `subjectId` and optionally `standardId` from URL params.
- If no `subjectId` is provided, an error message is shown ("No subject selected").
- PDF assets are fetched separately via `fetchChapterPdfAsset`.
- Lessons are fetched via `chapterLessons` API call.
- Content text is fetched via `chapterContentText` API call.

**Permissions:** View is open to teacher and student profiles. Authoring is in LMS curriculum planning (see [Scholar Learn](../../learn/)).

## 4. User flows

**Student/teacher views chapters:**
1. Navigate to Subjects → click a subject.
2. Redirected to `/chapters?subjectId=X`.
3. Chapter list loads; click chapter → tabs populate with content, resources, quiz.

**Download PDF:**
1. On Resources tab → click download icon → PDF fetched and downloaded.

## 5. Data model

**Table: `chapter_master`**

| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| syear | varchar | Academic year |
| sub_institute_id | int | Tenant |
| grade_id | int | Grade (section) |
| standard_id | int FK → `standard.id` | |
| subject_id | int FK → `subject.id` | |
| chapter_name | varchar | |
| chapter_desc | text nullable | |
| availability | tinyint | |
| show_hide | tinyint | |
| sort_order | int | |
| created_at | timestamp | |
| created_by | int | User id |

**Referenced by:** `lms_homework`, `lms_curriculum`, `lms_syllabus`, `pal_chapter_alignment`, `learner_node_state`.

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | (via `fetchChapters` in `_lib/chapters-api`) | JWT session | `subjectId`, `standardId` | `{ subject, chapters: [{ id, chapter_name, … }] }` |
| GET | (via `fetchChapterPdfAsset`) | JWT session | `chapterId` | PDF asset URL |
| GET | (via `chapterLessons`) | JWT session | `chapterId` | lessons array |
| GET | (via `chapterContentText`) | JWT session | `chapterId` | content text |

Exact backend endpoint paths: TBD (resolved at runtime via `erp-client` proxy).

## 7. UI components & design tokens
- Custom page component (not `AcademicSetupPage`).
- Icons: `FileText`, `Download`, `Play`, `CheckCircle2`, `Clock`, `BookOpen`, `ArrowLeft`, `Loader2` from `lucide-react`.
- Tabs: custom CSS tab pattern.
- `Link` from `next/link` for back navigation.

## 8. Reports & exports
- PDF download per chapter (Resources tab).
- Chapter progress data feeds LMS reports and PAL attainment reports.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| CH01 | Load chapters | Navigate with valid subjectId | Chapter list loads | Happy |
| CH02 | No subject | Navigate without subjectId | Error: "No subject selected" | Edge |
| CH03 | Download PDF | Click download on Resources tab | PDF downloaded | Happy |
| CH04 | No chapters | Valid subject with no chapters created | Message: "No chapters available" | Edge |
| CH05 | Tab switching | Switch between Overview/Content/Resources/Quiz | Each tab loads its content | Happy |

## 10. Known issues, limitations & FAQs
- Chapter authoring is not done on this page — it is in LMS curriculum planning.
- `timestamps = false` on the model means `updated_at` is not tracked.
- **FAQ:** "Chapter not showing" — check `show_hide = 1` and `availability` flag on the chapter record.

## 11. Sales notes
- Students and teachers get a clean chapter browser with PDF resources and embedded quiz.
- Demo: select subject → show chapter list → open chapter → show PDF download and quiz tab.

## 12. v1 status & v2 ideas
- v1: Viewer complete; authoring is in LMS module.
- v2: Inline chapter authoring; video content support; student progress bar per chapter.

## Source files
- `C:\rajesh\lms_k12\app\chapters\page.tsx`
- `C:\rajesh\lms_k12\app\chapters\_lib\chapters-api.ts` (TBD — not yet read)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\school_setup\chapterController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Models\school_setup\chapterModel.php`
