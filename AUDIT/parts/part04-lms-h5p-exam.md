# AUDIT PART 04 - LMS / H5P / Exam / Result / Course / Subjects / SQAA (`part04-lms-h5p-exam`, prefix `LMS`)

Auditor: read-only static analysis. Frontend: `D:\lms_k12` (Next.js). Backend traced: `D:\next_lms_erp` (Laravel, READ-ONLY).
No app code was modified, no dev server / build / migration / network call was run. No `.env*` file was read.
No secret/token/key was found in tracked source in this scope (nothing to redact). Live env values (`LMS_API_AUTH_ENFORCE`,
`QUESTION_ASSET_ORIGINS`, DB `tblmenumaster` links/rights) are `NOT VERIFIED`.

Method note: the frontend is a thin client. Almost every finding of consequence is on the Laravel side of the trace
(Menu -> Page -> Component -> API call -> route -> controller -> model/table -> response -> UI), so the issue blocks give both paths.

---

## 1. Scope & coverage

Depth vocabulary: **Read fully** = whole file (or every logic-bearing part) read; **Skimmed** = excerpts / grep of endpoints, gating,
sinks and calculations; **Not reviewed** = only listed / sized. Counts are approximate (rounded to the nearest few files) because
several large files were read in slices.

| Area/dir | Files in scope | Read fully | Skimmed | Not reviewed | Notes |
|---|---:|---:|---:|---:|---|
| app/lms | 96 | 7 | 45 | 44 | 40 pages. Homework/assignment/planning pages were traced through their `api.ts` + endpoint/gating greps, not line by line. `exam/page.tsx` (4231 lines) read in slices (QuestionPaperView, publish, practice submit). |
| app/course-master | 35 | 3 | 10 | 22 | `chapters/page.tsx` (6719 lines) and `lesson-plan/[courseId]/page.tsx` (3117) skimmed by grep for sinks/endpoints; coherence-map view components not reviewed. |
| app/h5p | 93 | 2 | 22 | 69 | 57 pages. Data layer (`h5p.ts` first ~700 of 1808 lines, `h5p-model.ts`, `question-bank-library.ts`) + every `dangerouslySetInnerHTML` sink read; individual editors/players not read line by line. |
| app/teach-learn | 14 | 12 | 2 | 0 | Category pages are 8-21 line wrappers. |
| app/chapters | 2 | 1 | 1 | 0 | |
| app/quiz | 4 | 2 | 2 | 0 | |
| app/subjects | 4 | 1 | 3 | 0 | |
| app/learning-outcome | 3 | 3 | 0 | 0 | 2-line wrappers over `MigrationModulePage` (read). |
| app/exam | 12 | 4 | 5 | 3 | `data/onlineExam.ts`, `data/aiPaper.ts`, `online/[paperId]/page.tsx` read fully; `marks-entry` first 420/654 lines. |
| app/exam-assessment | 1 | 1 | 0 | 0 | AI-stack config screen only. |
| app/result | 27 | 3 | 8 | 16 | `marks-entry`, hub `page.tsx`, `[slug]` read fully; `report-card` (save-html + render), `wrt-progress` calc read; other report pages skimmed/not reviewed. |
| app/sqaa + sqaa_master + sqaa_document_report | 9 | 3 | 0 | 6 | `_lib/api.ts` + wrappers read; components/types not reviewed. |
| lib/h5p | 27 | 0 | 9 | 18 | 14 are `*.test.ts` (not read). Scoring functions read via grep + excerpts (true-false, single-choice-set, drag-drop, memory-game, text-activity). |
| components/h5p | 14 | 0 | 2 | 12 | `EssayPlayer.tsx` sink read. |
| lib/teach-learn, curriculum-planning, lms-ai, exam-assessment, exam, sqaa | 6 | 0 | 1 | 5 | AI-stack descriptor configs (`AiStackModule`), identical shape; `lms-ai` sampled. |
| lib/question-paper | 12 | 1 | 0 | 11 | `images.ts` read; 6 test files + numbering/pagination/sections/options/types not reviewed. |
| lib/result | 3 | 1 | 1 | 1 | `api.ts` read fully; `masters.ts` (739 lines) skimmed. |
| components/result | 8 | 0 | 2 | 6 | `print.ts`, `DynamicForm.tsx` sink read. |
| services/g2g-lms.ts | 1 | 1 | 0 | 0 | Barrel re-export for the **People-Competency G2G LMS** (`app/people-competency/lms`). Not used by any in-scope module. |
| components/ui/g2g | 14 | 0 | 0 | 14 | Not imported by any in-scope module (grep). Out of scope de facto. |
| docs (h5p-*.md x3, LMS_CONTENT_ARCHITECTURE_BACKLOG_ACTION_PLAN.md) | 4 | 0 | 1 | 3 | Backlog doc first 60 lines read; h5p docs sized only. |
| app/api/{question-paper/asset, teach-learn/menu-categories, proxy} + lib/erp-client.ts + app/data/routeMapper.ts (dependencies of scope) | 5 | 4 | 1 | 0 | Read because they carry scope traffic. |
| **Frontend total** | **~372** | **~48** | **~114** | **~210** | |

Laravel files traced (read, in whole or the relevant methods): `routes/api.php`, `routes/lms.php`, `routes/resultapi.php`, `routes/result.php`,
`routes/web.php` (lms parts), `routes/pal_api.php` (h5p prefix), `app/Providers/RouteServiceProvider.php`, `app/Http/Kernel.php`,
middleware `ApiSessionHydrator`, `Concerns/HydratesLegacyApiSession`, `SessionMiddleware`, `RequireStaffRole`, `LmsApiAuth`, `RequireLmsStaff`,
`RequirePermission`, `checkPermission`, `MenuMiddleware`, `PalApiAuth`, `VerifyCsrfToken`; controllers `api/result/BaseResultApiController`,
`MarksEntryApiController`, `ExamMasterApiController`, `StudentResultApiController`, `UploadResultApiController`,
`result/marks_entry/marks_entry_controller`, `result/classwiseGradeReportController`, `result/new_result/studentResultController::save_result_html`,
`lms/onlineExamController`, `lms/assessmentQuestionController` (submitPractice/checkAnswer), `lms/reports/studentReportController::edit`,
`api/ApiQuestionPaperController`, `api/ApiLmsCourseController` (createQuestionBank/deleteQuestionBank/persistContent), `api/ExamEvaluationApiController`,
`api/QuestionPaperTemplateApiController` (tenant handling), `api/lms/StudentHomeworkApiController`, `api/lms/HomeworkSubmissionApiController`,
`api/lms/LmsResultDashboardApiController`, `api/lms/LessonPlanPeriodApiController`, `api/lms/LessonIntelligenceApiController` (dropdowns),
`api/MigrationModulesApiController`, `api/sqaa/SqaaApiController`, `lms/h5p/*` (Flashcard, ContentType base, Scenario, InteractiveVideo, ImageHotspots saveRules),
`Services/lms/H5P/H5PPackageArchive`, `Helpers/Helper.php::getGrade/getGradeScale`, `AJAXController` list lookups.
Not traced: models/migrations for most tables (no DB access), `H5PTextActivityController`, `H5PDragDropController`, `lmsDashboardController`, PAL controllers beyond middleware.

---

## 2. Module inventory (your scope)

| Module | Backend (Laravel controller/route or Next api) | Frontend pages/components | DB tables (if traced) | API endpoints | Permissions/roles | Menu entry | Status |
|---|---|---|---|---|---|---|---|
| Result - marks entry / approval | `routes/resultapi.php` group `api/result` (`api.session` only) -> `MarksEntryApiController` -> `marks_entry_controller` | `app/result/marks-entry` (new), `app/exam/marks-entry` (legacy duplicate) | `result_marks`, `result_create_exam`, `result_exam_approve`, `result_std_grd_maping`, `grade_master_data` | `GET api/result/marks-entry/create`, `POST api/result/marks-entry`, `POST .../approve`; legacy `POST result/marks_entry` | None on API (any valid JWT incl. student/parent). Frontend: none. | `marks_entry.index` -> mapper returns `/result/marks_entry` (no such page) | Mostly complete, unauthorised, integrity gaps |
| Result - masters (exam master/type/creation, grade, std-grade map, result master, book master, remark master, co-scholastic, working days, HPC skillset/activity, templates) | `Result*ApiController`s delegating to `result\*` web controllers | `app/result/master/[slug]` (config-driven `MasterCrud` + `lib/result/masters.ts`), `master/exam-master`, `master/grade-master` | `result_exam_master`, `result_create_exam`, `grade_master_data`, `result_master_confrigration`, `result_template`, ... | `api/result/<resource>` CRUD + `/bulk` | None; bare-`id` update/delete not tenant-scoped | route-name links map to non-existent pages (LMS-27) | Mostly complete, IDOR |
| Result - reports / report cards | `ResultReportApiController`, `Cbse*ApiController`, `WrtReportApiController`, `ClasswiseGradeReportApiController`, `StudentResultApiController`, `ConsolidateReportApiController` | `app/result/reports/*`, `app/result/report-card/*`, `app/result/student-result-remarks`, `student-attendance` | `result_html`, `result_reportcard_marks`, `result_marks`, `result_remark*` | `api/result/*-report*`, `student-result`, `student-result/save-html` | None | as above | Mostly complete; "Print mobile" destructive (LMS-12) |
| Result - upload / mobile approve / HPC entry / co-scholastic entry | `UploadResultApiController`, `ApproveMobileResultApiController`, `ResultActivityMarks*`, `CoScholasticMarksEntryApiController` | `app/result/upload-result`, `approve-mobile-result`, `hpc-*`, `co-scholastic-marks` | `upload_result`, `result_activity_marks(_V1)`, co-scholastic tables | `api/result/upload-result` etc. | None | as above | Mostly complete |
| Exam - AI paper generator (`/exam/exam-creation`) | `ApiQuestionPaperController::store` (+ `lms-questions`, `question-mapping-levels`, `lms-courses`) | `app/exam/exam-creation`, `app/exam/data/aiPaper.ts` | `question_paper`, `lms_question_master`, `lms_mapping_type` | `POST /api/question-paper`, `POST /api/lms-questions`, `GET /api/question-mapping-levels`, `POST /api/lms-courses` | None (anonymous) | `generate_ai_questionpaper` -> `/exam/exam-creation` | Partially complete (metadata dropped, LMS-24) |
| Exam - online exam attempt/result (`/exam/online*`) | `lms/onlineExamController` (web group `session,menu,logRoute,check_permissions`, `type=API`), `ApiQuestionPaperController::index` | `app/exam/online/page`, `[paperId]/page`, `[paperId]/result/page`, `data/onlineExam.ts` | `question_paper`, `lms_online_exam`, `lms_online_exam_answer`, `answer_master`, `lms_question_master` | `GET /api/question-paper`, `GET/POST /lms/online_exam`, `GET /lms/online_exam/{id}`, `GET /lms/online_exam_attempt` | Any authenticated user; no role/ownership/window/attempt checks | `online_exam.index` -> `/exam/online` | Broken (integrity, LMS-02/07/08/09) |
| Exam - legacy exam master / marks entry / progress report | `result/exam_master`, `result/marks_entry` (web), `lmsExamwise_progress_report` | `app/exam/exam-master`, `marks-entry`, `progress-report` | as Result | web routes + `/api/proxy` | menu-rights (route-name based) | `exam_master.index` -> `/result/master/exam-master`; `marks_entry.index` (path form) -> `/exam/marks-entry` | Duplicate of Result module (LMS-28) |
| LMS Exam Operations (`/lms/exam`, `/lms/worksheet`, `/lms/project`) | `ApiQuestionPaperController`, `QuestionPaperTemplateApiController`, `AssessmentBlueprintApiController`, `ExamEvaluationApiController`, `LmsResultDashboardApiController` | `app/lms/exam/page.tsx` + `_question-paper-templates`, `_assessment-blueprint`, `_exam-evaluation`, `_result-dashboard`; `_shared/question-paper-grid`, `assign-work-panel` | `question_paper`, `template_master`, blueprint tables, `exam_evaluation_*`, `lms_offline_exam(_answer)` | `/api/question-paper*`, `/api/question-paper-templates*`, `/api/assessment-blueprints*`, `/api/exam-evaluation/*`, `POST /api/lms-result-dashboard/summary` | Result dashboard: `api.session`+`staff.only`. All others anonymous. Frontend gates on `userProfileName` only. | `question_paper.index` -> `/lms/exam` | Mostly complete, backend unauthenticated (LMS-04/05) |
| LMS Homework | Legacy `StudentHomeworkApiController` (anonymous), v2 `HomeworkSubmissionApiController` (`api.session`, review = `+staff.only`), `HomeworkQuestionBankApiController` | `app/lms/homework/*` (list, assign, submission, report, review, `[id]`), `homework/api.ts` | `homework` (+ `homework_evaluation_answer`) | `lms-homework/*` | Frontend `RequireStaff` on staff pages; backend gaps (LMS-06/18) | `student_homework` -> `/lms/exam` (mapper) | Mostly complete |
| LMS Assignment / Submission / Annotate | `LmsAssignmentApiController` (routes re-declared under `api.session`(+`staff.only`) after anonymous legacy declarations - later registration wins) | `app/lms/lmsAssignment*`, `lmsAnnotate_assignment` | `lms_assignment*` | `lms-assignment/*` | Backend enforced; frontend `RequireStaff` | `lmsassignment.index` | Mostly complete |
| LMS planning (curriculum-planning, lesson-plan, monthly-plan, syllabus-plan, teacher-diary, teacher-timetable) | `/api/intelligence/*` (anonymous), `lms/lms_syllabus` (web menu-checked) | `app/lms/curriculum-planning/*`, `lesson-plan`, `monthly-plan`, `syllabus-plan`, `teacher-*` | `lms_intelligence_lesson_plans`, `lms_lesson_plan_periods`, ... | `/api/intelligence/*`, `/lms/lms_syllabus` | Frontend `RequireStaff`; backend anonymous for `/api/intelligence/*` | mapped | Mostly complete, unauthenticated (LMS-06) |
| LMS dashboards / engagement (dashboard, teacher-dashboard, activity-stream, leader-board(+master), social-collaborative, student-analysis, question-wise-report, reports, book-list, global-mapping) | `lms/lmsdashboard`, `lmsActivityStream`, `lmsStudent_report`, `lms/lmsmapping`, `lb_master` (web menu group); `api/lms/leaderboard*`, `social-collaborative*` (`api.session`) | `app/lms/{dashboard,activity-stream,leader-board*,social-collaborative,student-analysis,...}` | many | see Section 5 | Leaderboard/social: token tenant, staff-only master. Legacy web: request tenant preferred over session (LMS-09) | mapped | Mostly complete |
| LMS Message / Project & Worksheet wrappers / Teacher resource | none (Blade placeholder) / reuse of `AssignWorkPanel` / reuses `app/library/book_resources` | `app/lms/message`, `lmsProject`, `lmsWorksheet`, `lms_teacherResource` | - | - | `RequireStaff` where present | mapped | Message = Stub (honest placeholder). `lms/api/teacher_resource/*` = backend-without-UI, anonymous |
| Course Master (courses, chapters authoring, content upload/generation, coherence map, concept intelligence tab labels, lesson-plan under course) | `ApiLmsCourseController`, `contentController::storeGammaContent`, `IntelligenceQuestionGenerationApiController` (`api.session+staff.only`), `CoherenceMapApiController` (`lms.auth`), `ConceptIntelligenceTabLabelApiController` | `app/course-master/**`, `data/*.ts` | `content_master`, `lms_question_master`, `chapter_master`, `sub_std_map`, ... | `/api/lms-courses`, `lms-chapters*`, `lms-chapter-content*`, `lms-question-bank*`, `lms/gamma-content-master`, `lms/coherence-map*` | Client-supplied role string; `lms.auth` is warn-only | course-master | Mostly complete, unauthenticated authoring (LMS-04/21/34) |
| H5P content authoring & playback (14 types + question-bank library + hub + model) | `routes/lms.php` prefix `h5p` (`session,menu,logRoute,check_permissions`) -> `H5P*Controller` + `H5PContentTypeController` base; `api/pal/h5p/*` (`pal.auth`); `POST get-h5p-ai-scenario` (no middleware) | `app/h5p/**` (57 pages), `components/h5p`, `lib/h5p` | `h5p_*` tables, `lms_question_master` | `/h5p/*`, `/api/pal/h5p/*`, `/get-h5p-ai-scenario`, `/api/lms-question-bank` | Frontend hides edit for students; backend has no role check on writes (LMS-17) | `h5p.index` etc. -> `/h5p/*` | Mostly complete; score persistence Missing (LMS-22) |
| Quiz (`/quiz`, `/quiz/create`, `/quiz/take`) | none (only `lms-courses` for dropdowns) | `app/quiz/**` | - | `POST /api/lms-courses` | none | - | **Stub / mock** (LMS-29) |
| Subjects / Chapters | `lms-courses`, `lms/new_chapter_master`, `lms-chapter-content` | `app/subjects/**`, `app/chapters` | - | see Section 5 | none | - | Mostly complete (progress = curriculum coverage, not student progress) |
| Teach/Learn hub | `api/teach-learn/menu-categories` (`api.session`+`check_permissions`) via Next proxy `app/api/teach-learn/menu-categories` | `app/teach-learn/**` (ModuleCategoryPage), screen registry embeds LMS/exam/PAL pages | `fees_menu_categories`, `fees_menu_category_items` | `GET /api/teach-learn/menu-categories` | Backend menu rights; **proxy SSRF (LMS-19)** | teach-learn | Complete (hub) |
| Learning Outcome (`/learning-outcome/*`) | `api/MigrationModulesApiController` (JWT-valid only, tenant from body) | `app/learning-outcome/*` -> `MigrationModulePage` | `learning_outcome_indicator`, `learning_outcome_question_master`, `result_marks` | `GET /api/migration-modules/{module}` | none; tenant client-supplied | `MIGRATION_MODULE_ROUTES` | **Partially complete: read-only generic table viewer; create/delete exist in API, no UI** (LMS-20) |
| SQAA (`/sqaa`, `/sqaa_master`, `/sqaa_document_report`) | `SqaaApiController` (`api.session`, tenant from token) | `app/sqaa/**` | `sqaa_master`, `sqaa_documant_master`, `sqaa_documents`, `sqaa_mark` | `GET api/sqaa/levels`, `GET api/sqaa/entry/{menuId}`, `POST api/sqaa/entry`, `GET api/sqaa/document-report` (all via `/api/proxy`) | Any authenticated user | mapped | Mostly complete; multipart upload corrupted by proxy (LMS-30) |
| AI Stack config screens (lms, exam, exam-assessment, teach-learn, curriculum-planning, sqaa) | shared `/api/ai/*` (other part) | `app/*/ai-stack`, `lib/*-ai-stack.ts` | - | - | - | ai-stack | Configuration descriptors only (not audited further) |
| G2G LMS barrel (`services/g2g-lms.ts`, `components/ui/g2g`) | `routes/g2g_lms.php` | `app/people-competency/lms` | - | - | - | - | Out of scope in practice (not used by in-scope modules) |

Flags:
- **Backend-without-UI:** `api/migration-modules` `POST/DELETE` (learning outcomes, indicator mapping); `lms/api/teacher_resource/*`; `H5P *_export/import` for some types (UI exists for some); `api/result/*` endpoints `personalize-marks`, `pal-marks`, `map-value`, `current-result`, `overall-mark-report`, `cbse-1t5-t2-result` variants are only partly surfaced.
- **UI-without-backend:** `/quiz/create` "Publish Quiz" and `/quiz/take` (no API at all); `/lms/message` (declared placeholder).
- **Menus/links pointing at missing pages:** 35 `RESULT_ROUTE_NAME_MAP` entries in `app/data/routeMapper.ts` (LMS-27); typo key `'ai_questionpaper.ind ex'` (line 151).
- **Duplicate modules under different names:** `/exam/marks-entry` vs `/result/marks-entry`; `/exam/exam-master` vs `/result/master/exam-master`; two online-exam UIs (`/exam/online/[paperId]` vs `QuestionPaperView` inside `/lms/exam`); `MigrationModulePage` learning-outcome vs Laravel `learning_outcome` Blade module (LMS-28).

---

## 3. Role / access-control findings (frontend gating vs backend enforcement)

Global facts: there is no `middleware.ts`; the only page guard is `ConditionalApp` (`app/components/ConditionalApp.tsx`) which shows `LoginPage` when `!isAuthenticated` (client state). Role gating is a per-page client convention: `RequireStaff` (`app/lms/_shared/RequireStaff.tsx`) redirects a "student session" (localStorage `user_profile_name`) - it is a UX backstop, never a control. Used on 25 LMS pages (+ fees/documents/student); **not used** in `app/result`, `app/exam` (except a note banner), `app/course-master/**` (except a preview toggle), `app/h5p/**` (only `isStudentProfile()` to hide edit buttons), `app/quiz`, `app/subjects`, `app/chapters`, `app/sqaa`, `app/learning-outcome`.

| Module | Frontend gating | Backend enforcement | Verdict |
|---|---|---|---|
| Result (all 31 screens) | None. Hub `/result` lists every screen to any authenticated role. | `api.session` only (JWT valid). No `staff.only`, no `check_permissions`, no rights lookup. Only `DropdownApiController` reads profile name to narrow lists. | **Student/parent/teacher can call every master mutation, marks entry, approval, report and upload.** (LMS-03, LMS-11) |
| Exam - online attempt | `isStudentProfile()` only decides a banner ("You're not a student"). | `lms/online_exam` behind menu middleware but no role/ownership/window/attempt check; `user_id` taken from request. | Any authenticated user can submit as any `user_id` (LMS-07/08/09). |
| Exam - AI paper / LMS Exam Operations | `audienceMode` from profile string; "Teacher" UI hidden for students. | `/api/question-paper*`, templates, blueprints, evaluation: **no auth at all**; role for listing is the `user_profile_name` query param. Only result-dashboard has `api.session+staff.only`. | Anonymous (LMS-04/05). |
| Homework | `RequireStaff` on staff pages. | Legacy `lms-homework/*`: none, role from body. v2 submit/detail: `api.session` and pinned to session student. Review routes: `api.session+staff.only` but no tenant/ownership scoping on `find($id)`. `submission-file/{id}` any authenticated user, no ownership. | Split; gaps (LMS-06/18). |
| Assignment | `RequireStaff` on authoring/annotate pages. | Enforced: `api.session`(+`staff.only`) - the later registration overrides the earlier anonymous duplicates. | OK (note the fragile duplicate registration). |
| LMS planning | `RequireStaff`. | `/api/intelligence/*`, `/api/lesson-intelligence/*`: none. | Anonymous (LMS-06). |
| Leader board / social | student toggle in UI. | `api.session` (tenant/user from token), master `staff.only`. | OK. |
| Course master authoring | `isStaff` preview toggle only; `RequireStaff` absent. | `ApiLmsCourseController`: no auth; role check uses client `user_profile_name`. `lms.auth`/`perm:` on 3 legacy write routes are **warn-only** (`config('lms_content.api_auth_enforce', false)`). | Anonymous / spoofable (LMS-04, LMS-21, LMS-34). |
| H5P | `isStudentProfile()` hides edit/delete buttons. | `H5PContentTypeController` write actions (`store/update/destroy/publish/duplicate/import/media`) have no role check; students only lose draft visibility on read. Legacy flashcard/video/scenario use unscoped `findOrFail`. `get-h5p-ai-scenario` has no middleware. | No server authz (LMS-17). |
| Quiz / Subjects / Chapters | none | n/a / anonymous `lms-courses` | mock / anonymous |
| Learning outcome | none | `MigrationModulesApiController::guard` validates the JWT signature only; tenant/user from body | LMS-20 |
| SQAA | none | `api.session`, tenant from token; no role check | acceptable; all roles can write |
| Teach/Learn | none | `api.session`+`check_permissions` (menu rights) | OK backend; proxy SSRF (LMS-19) |

Roles:
- Admin/Teacher/Student/Parent: `user_profile_id -> tbluserprofilemaster.name` (`HydratesLegacyApiSession` maps `is_admin` 1/2 to "Super Admin"). `staff.only` = *blocklist* of student/parent only (`RequireStaffRole`), so any other profile name passes; `RequireLmsStaff` passes anonymous callers through (defers to controller).
- `check_permissions` (`checkPermission.php`) resolves rights by `tblmenumaster.link == Route::currentRouteName()`; resource sub-routes (`.store/.update/.create`) will only be checked if a menu row carries that exact route name. NOT VERIFIED against DB (LMS-32).

---

## 4. Tenant / school / academic-year scoping findings

Tenant key `sub_institute_id`, year `syear`, user `user_id`. How each entry path derives them:

| Path | Where `sub_institute_id` / `user_id` / `syear` come from | Trusted server-side? |
|---|---|---|
| `api.session` routes (`ApiSessionHydrator`) | Token claims for tenant/user/profile; **`syear` and `term_id` from request** (`$request->input('syear')`) | Tenant/user: yes. `syear`: client-selected but validated only against nothing (cannot cross tenant). Good pattern. |
| Result API controllers | `session('sub_institute_id')` (token) for reads/list; **bare `id` for update/delete** | List scoping good; mutation by id **not tenant-scoped** (LMS-03). `getRank` API branch reads `$_REQUEST['sub_institute_id']`, `$_REQUEST['syear']` and forces `term_id = 149` (LMS-13). |
| Legacy web routes via `session` middleware + `type=API` (`lms/online_exam`, `lms/lmsStudent_report`, `lms/lmsdashboard`, ...) | Token hydrates the session, **but controllers read `$request->get('sub_institute_id') ?: session()`** (request first) | **Client value wins** -> tenant and user spoofing (LMS-09). |
| H5P legacy controllers (Scenario, InteractiveVideo `store`) | For `type=API`: `$sub_institute_id = $request->sub_institute_id; $user_id = $request->user_id; $syear = $request->syear` (explicitly overrides the hydrated session) | Client-controlled (LMS-17). Newer `H5PContentTypeController::tenant()` prefers session and `findForTenant()` scopes reads/writes - good. Flashcard `index/store` use session, but `edit/update/destroy` use unscoped `findOrFail($id)`. |
| Anonymous `/api/*` (question-paper, lms-courses, lms-question-bank, exam-evaluation, blueprints, templates, lms-homework legacy, intelligence/*, lesson-intelligence/*) | Request body/query (`sub_institute_id`, `syear`, `user_id`, `user_profile_name`) | Fully client-controlled; several accept **missing** tenant as "all tenants" (`->when($sub_institute_id, ...)`), e.g. `lms-homework/bulk-delete`, `lms-homework/review-list`. |
| `MigrationModulesApiController` | JWT validity checked, then `$r->integer('sub_institute_id')` | Client-controlled; `learning-outcomes` list/delete not tenant-filtered at all (LMS-20). |
| SQAA | `session('sub_institute_id')` (token) | Yes. |
| `POST result/student-result/save-html` | session tenant | Yes (but writes client HTML/zeros, LMS-12). |
| Frontend | `buildSessionContext()` (`lib/erp-client.ts`) picks active year from `academicTerms[0]` / `selectedAcademicYear`; `app/course-master/page.tsx::getSyear()` and `lib/result/api.ts::getResultSession()` use `selectedAcademicYear` else `academicYears[0]` / `userData.syear` | **Three different year-resolution rules** in one product (LMS-35); `baseUrl` is read from localStorage `host_name` (`erp-client.ts`) so a tampered value redirects the bearer token to another host (self-inflicted, Low). |

Additional facts: `getRank()` hard-codes `term_id = 149` for API callers; `getPassingRatio` hard-codes grade ids 148/149 (33%) else 35% and grade ids 146/147 for display; `AJAXController::getStandardList` hard-codes `sub_institute_id == 195` menu-id lists. These are tenant-specific constants in shared code.

---

## 5. API endpoints consumed or exposed

Auth column = what the Laravel route actually enforces (not what the frontend sends). "Anon" = no middleware beyond the `api` group `throttle:1000,1`. "api.session" = JWT verified, tenant/user from token. "web+menu" = `session,menu,logRoute,check_permissions` (JWT hydrated when `type=API`).

### 5.1 Result (`routes/resultapi.php`, prefix `api/result`, `api.session`)
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| GET | `/api/result/marks-entry/create` | api.session | required filters | Returns students, `grd_data`, `approve_status`; 500 if exam id invalid (`$working_day[0]` undefined). |
| POST | `/api/result/marks-entry` | api.session | `values` array, `values.*.exam_id` only | Trusts `points/per/grade` (LMS-11). |
| POST | `/api/result/marks-entry/approve` | api.session | required ids | Any role; lock not enforced on save. |
| POST | `/api/result/marks-entry/{marks-approval,marks-dd,co-scholastic-marks-dd,get-result}` | api.session | student_id numeric | `get-result` accepts caller `sub_institute_id`/`syear` defaults. |
| GET/POST/PUT/DELETE | `/api/result/{exam-master,exam-type-master,grade-master,standard-grade-mapping,working-day-master,result-remark-master,result-master,exam-creation,result-book-master,co-scholastic-master,co-scholastic,hpc-skillset,hpc-activity-master,result-template}` (+`/bulk`, `/create`, `/dropdown`) | api.session | per-controller | Update/delete by bare id (LMS-03). |
| GET/POST | `/api/result/{student-attendance-master,co-scholastic-marks-entry,hpc-activity-entry,hpc-entry-v1,student-result-remarks,approve-mobile-result,upload-result}` | api.session | light | `upload-result`: `image.*` = `file` only (LMS-15). |
| GET/POST | `/api/result/{result-report,consolidate-report,classwise-grade-report,cbse-1t5-result,cbse-1t5-t2-result,cbse-11-t2-result,wrt-report,wrt-progress-report,overall-mark-report}` (+`/show`, `/pdf`, `/save-html`) | api.session | light | Rank helper forces term 149 in API mode (LMS-13). |
| GET/POST | `/api/result/student-result`, `POST /api/result/student-result/save-html` | api.session | `student_arr`, `term_id`, ... | Overwrites attendance/percentage (LMS-12). |
| GET | `/api/result/all-results[/{id}]`, `personalize-marks`, `pal-marks`, `map-value`, `current-result`, `dropdowns/*` | api.session | - | `all-results` "student token". |
| GET | `/api/get-{grade,standard,division,subject,exam-master,exam,co-scholastic,activity-master}-list` | **Anon** (`routes/result.php`, web group, no auth) | none | Tenant from `sub_institute_id` request param; unauthenticated school-structure enumeration (LMS-06). |
| GET/POST | `/result/marks_entry`, `/result/marks_entry/create`, `/result/exam_master` (+resource) | web+menu | legacy | Used by `/exam/marks-entry`, `/exam/exam-master` through `/api/proxy`. CSRF exempt only by host wildcard (LMS-32). |

### 5.2 Exam / question paper / online exam
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| GET/POST | `/api/question-paper` (index) | **Anon** | tenant/syear presence only | **SQLi** via `whereRaw` interpolation (LMS-01); role from `user_profile_name` query. |
| POST/PUT/DELETE | `/api/question-paper`, `/api/question-paper/{id}` | **Anon** | none | Insert/overwrite/delete any paper; tenant from body. |
| GET | `/api/question-paper/{id}`, `/{id}/pdf` | **Anon** | - | `show` returns question rows + `answer_arr` including `correct_answer` to anyone. |
| POST | `/api/question-paper/search` | **Anon** | standard/subject required | **SQLi** via `search_chapter[]`/`search_topic[]` implode and tenant interpolation (LMS-01). |
| GET/POST | `/lms/online_exam` (paper load), `/lms/online_exam` POST (submit), `/lms/online_exam/{id}` (result), `/lms/online_exam_attempt` | web+menu | none | Score from client flags (LMS-07), SQLi in `show` (LMS-02), user from request (LMS-09). |
| POST | `/lms/submit-practice`, `/lms/adaptive-practice`, `/lms/student-profile`, `/lms/class-insights`, `/lms/teacher-dashboard`, `/lms/forgetting-curve` etc. | `routes/web.php` top level: **no middleware** | `student_id` from request | Server-side scoring is correct, but `student_id`/tenant are caller-supplied (LMS-09). |
| GET | `/api/question-mapping-levels`, POST `/api/lms-questions`, `/api/lms-courses`, `/api/lms-chapters`, `/api/lms-chapter-concepts`, `/api/lms-chapter-content` | **Anon** | tenant in body | |
| POST | `/api/question-bank/{filters,search,question-types}` | **Anon** | | |
| POST | `/api/lms-question-bank[/create|/update|/delete|/review]` | **Anon** | integer ids; delete/update have a chapter-owner-tenant check keyed on the **caller-supplied** tenant | Guard prevents accidents, not attackers (LMS-04). |
| POST | `/api/lms-chapters/store`, `/api/lms-store-subject` | **Anon** | | Creates chapters/subjects in any tenant. |
| POST | `/api/lms-create-content`, `/api/lms-store-content`, `/api/lms-chapter-content/upload` | `lms.auth` + `perm:lms.content,create` **warn-only** (anonymous allowed while `LMS_API_AUTH_ENFORCE` false) | `link` any string, `filename` any file | Role from client `user_profile_name` (LMS-21). |
| POST | `/api/lms/gamma-content-master` | `throttle.contentgen` only | tenant/user from body | Route comment says unauthenticated; used by `sideDrawer.tsx:783`. |
| POST | `/api/intelligence/questions/generate` | api.session+staff.only+throttle.qgen | | Correct pattern. |
| POST | `/api/intelligence/content/generate` | api.session+staff.only+throttle | | Not called by frontend (drawer still uses the anonymous sibling). |
| GET/POST/PUT/DELETE | `/api/question-paper-templates[...]`, `/paper/{id}` | **Anon** | tenant required | Tenant-scoped by caller value. |
| GET/POST/DELETE | `/api/assessment-blueprints[...]`, `/hpc-options` | **Anon** | tenant from body | |
| GET/POST/DELETE | `/api/exam-evaluation/{batches,sheets,answer-key,...}`, `POST .../batches/{id}/publish` | **Anon** | tenant, ids | Publishes to `lms_offline_exam` (gradebook) (LMS-05/25). |
| POST | `/api/lms-result-dashboard/summary` | api.session+staff.only | | Correct; NULLIF guards. |

### 5.3 LMS homework / assignment / planning / engagement
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| POST | `/api/lms-homework/{get-subjects,get-chapters,list,store,show/{id},update/{id},delete/{id},bulk-delete,students,homework-subjects,submission-list,submission-store,submission-report,ai-status/{id}}` | **Anon** | `sub_institute_id`,`syear` numeric | Legacy family; `bulk-delete` without tenant filters deletes by id list (LMS-06); uploads unrestricted (LMS-15). |
| POST | `/api/lms-homework/{detail/{id},submission/store,submission/ai-status/{id},submission-file/{id},my-submissions}` | api.session | files `pdf,jpg,jpeg,png` 10 MB | `submissionStudentId` pins students. `submission-file/{id}` no ownership check (LMS-18). |
| POST | `/api/lms-homework/{review-list,review-detail/{id},review-store,review-reprocess/{id}}` | api.session+staff.only | `status` enum | No tenant/ownership scoping; `reviewed_by` from body (LMS-18). |
| POST | `/api/lms-homework/question-bank/{types,questions}` | api.session+staff.only | | |
| POST | `/api/lms-assignment/*` | api.session (+staff.only for authoring) | | Later registration shadows anonymous duplicates at `routes/api.php:325-337`. |
| GET/POST | `/api/intelligence/{lesson-plans,curriculum-planning[/chapter],monthly-plan,lesson-plan-detail,lesson-plan-lookup/*}`; POST `/api/intelligence/lesson-plan-periods[/{id}/update|delete]` | **Anon** | tenant required | Anonymous create/update/delete of lessons. |
| GET/POST | `/api/lesson-intelligence/{dropdowns,dropdowns/filter,capacity,calendar-events,macro-plan*,meso-plan*}`, POST `micro-plan/period/{id}`, `micro-plan/plan/{id}/batch` | **Anon** | tenant required | `dropdowns` lists **every school** (`school_setup`); `micro-plan` triggers billable LLM calls (LMS-06). |
| GET/POST | `/api/lms/concept-intelligence/tab-labels[/update|/reset]` | **Anon** (session wins if present) | | Anonymous rename/reset of tab labels per tenant. |
| GET | `/api/semantic-intelligence*`, `/api/lms/concept-intelligence/*` | **Anon** | | Read-only. |
| GET | `/api/lms/coherence-map*` | `lms.auth` (warn-only) (+`perm:lms.curriculum,update` on writes) | | |
| GET/POST | `/api/lms/leaderboard*`, `/api/lms/social-collaborative*`, `/api/lms/leaderboard-master*` | api.session (master +staff.only) | | Correct pattern. |
| GET/POST | `/lms/{lmsdashboard,lmsActivityStream,lmsStudent_report,lmsmapping,lms_syllabus,lb_master,ajax_*}` | web+menu | | Request tenant preferred (LMS-09). |
| POST | `/lms/show_question_wise_report` | web+menu | | |
| GET | `/school_setup/lessonplanningReport`, `/frontdesk/book_list` | web+menu | | |
| GET/POST | `/lms/api/teacher_resource/*` | **Anon** | tenant in request | No frontend caller. |

### 5.4 H5P
| Method | URL | Auth | Validation | Notes |
|---|---|---|---|---|
| GET/POST/PUT/DELETE | `/h5p/{scenario_based,h5p_interactive_video,h5p_flashacard,h5p_mcq,html_contents}[/{id}]` | web+menu | scenario `store`: **none for file**; video `mimes:mp4,mov,avi,mkv,webm|max:1024000`; flashcard: `question`,`correct_answer` strings | Legacy controllers: unscoped id lookups, request-tenant in API branch, no role checks (LMS-17). |
| GET/POST/PUT/DELETE | `/h5p/{h5p_drag_drop,h5p_drag_text,h5p_blanks,h5p_mark_the_words,h5p_image_hotspots,h5p_memory_game,h5p_course_presentation,h5p_arithmetic_quiz,h5p_single_choice_set,h5p_true_false}[/{id}]` + `/import`, `/media`, `/{id}/export|publish|duplicate` | web+menu | `saveRules()` per type; media `mimes` per role, extension from client name | Tenant-scoped (`findForTenant`), no role check on writes; export reads arbitrary local path (LMS-16). |
| GET | `/h5p/question_bank/{h5pType}` | web+menu | | |
| GET/POST | `/api/pal/h5p/{registry,hub,chapters,chapter-model,coverage,engagement,pedagogy/select,insights,suggest-tags,nodes/...,coverage-matrix}` | pal.auth | learner ownership enforced for `learner_id` | `POST /api/pal/h5p/xapi` and `/xapi/batch`: learner ownership enforced, `success` self-reported (LMS-22). |
| POST | `/get-h5p-ai-scenario`, `/get-h5p-ai-output` | **no middleware** | prompt/image only | LLM spend, TLS verification disabled (LMS-06/37). |
| POST | `/api/lms-question-bank` | Anon | | Used by question-bank library (`question-bank-library.ts:116`). |

### 5.5 Other
| Method | URL | Auth | Notes |
|---|---|---|---|
| GET/POST | `api/sqaa/{levels,entry/{menuId},entry,document-report}` via `/api/proxy?path=` | api.session | Validated; `POST` multipart broken by proxy (LMS-30). |
| GET/POST/DELETE | `/api/migration-modules/{module}[/{id}]` | JWT-valid only | Tenant/user/year from body (LMS-20). |
| GET | `/api/teach-learn/menu-categories` | api.session+check_permissions | Reached through Next proxy (LMS-19). |
| GET | Next `/api/question-paper/asset?url=` | Anon | Allow-listed image fetch; `redirect: 'follow'` (LMS-33). |
| GET | Next `/api/teach-learn/menu-categories` | Anon; forwards Bearer+Cookie to `x-laravel-base-url` header | SSRF (LMS-19). |
| any | Next `/api/proxy?path=` | Anon, forwards Authorization+Cookie to fixed `API_BASE_URL` | Reads bodies as text (binary corruption, LMS-30). Owned by another audit part. |

---

## 6. Business-logic notes (Input -> Validation -> Rule -> DB change -> Side effect -> Output)

**6.1 Marks entry (scholastic).** Input: grid of `marks` per student, `per` and `grade` computed in the browser (`app/result/marks-entry/page.tsx:96-116`: `per = round2(marks/max*100)`, grade = first range containing `Math.round(per)` from `getGreadData` integer ranges). Validation: client-only (`isValidMark`: 0..min(max,500), or AB/N.A./EX). Rule (server `marks_entry_controller::store`): `points` containing a letter -> `AB/N.A./EX` stored as `points=0, per=0, is_absent=<code>` (any other text becomes "AB"); numeric -> stored verbatim with client `per`, `grade`; empty `points` -> **no write** (existing mark cannot be cleared) yet reports "Data Saved/Updated"; `$res` is overwritten per student so the response message reflects only the **last** student; exception per student is swallowed. `ResultLock::isLocked` blocks locked exams, **`result_exam_approve` is never consulted** so "approved" exams accept edits. DB: `result_marks` upsert by `(sub_institute_id, student_id, exam_id)`; unique constraint NOT VERIFIED (race -> duplicates). Side effect: FCM notification for client_id 4/11; `AuditLog`. Output: last-row message.
 Rule defects: no `points <= result_create_exam.points`; negative allowed server-side; `student_id` key from body not verified to belong to tenant/class; `exam_id` not verified to belong to tenant/standard/subject; teacher scoping absent (any teacher can write any class).

**6.2 Approve / unapprove marks.** `POST marks-entry/approve` toggles `result_exam_approve.status` for `(subject,standard,division,exam,term,tenant,'result_mark')`, records `created_by`. Any authenticated role may approve or unapprove. UI states "Teachers will no longer be able to edit" but nothing server-side enforces it (LMS-11).

**6.3 Grade / percentage / rank / pass-fail (backend).** `getGrade()` (`Helpers/Helper.php:2282`): `per = round(100*obt/total)` **before** matching descending breakoffs (74.5 -> 75; 34.5 -> 35) and returns `-` for `total==0`. `getRank()` (`classwiseGradeReportController.php:323`): sums `rm.points`/`rc.points` per student for exams with `report_card_status='Y'`; `percentage = SUM/SUM*100` (NULL when denominator 0); `failed = COUNT(points/rc.points*100 < passing_ratio)` with `passing_ratio = 33` for section ids 148/149 else `35`; absent/N.A./EX stored as 0 are counted as zero **and** as fails; rank = dense rank on the exact float percentage string (1,2,2,3), ties broken only by roll_no order for row order; **in API mode `term_id` is forced to 149** and `syear`/`sub_institute_id` are read from `$_REQUEST`. The controller calls `getRank` inside `foreach student` x `foreach exam title` (one full-class aggregate query per student per exam). "Average" row in the grand-total block sums `total_points` (it is a total of maxima, not an average). Thresholds elsewhere: frontend online-exam band 35/50/75, dashboard `AT_RISK_PERCENT = 40`, H5P `pass_percentage` per activity - four independent definitions of "pass".

**6.4 Online exam attempt (student).** Input: `answer_multiple[qid][] = "<answerId>##<correct_flag>"` (radio and checkbox both use this field), `answer_narrative[qid]`, `user_id`, `hid_session_quiz` (client start time). Rule (`get_calculate_marks`): a selected option is "right" if the **posted flag** equals 1; multi-answer question is right when every id in `answer_master.correct_answer=1` appears among ids the client flagged 1 (`array_diff(original, given)`), extra wrong selections are ignored and `$given_ans_arr` is never reset per question; any non-empty narrative is "right" and earns the question's `points`; marks = `SUM(points)` of right questions. DB: `lms_online_exam` + per-answer rows (`ans_status` 'right'/'wrong'); event `ExamSubmitted`. Not enforced: exam window (`open_date/close_date`), `attempt_allowed`, `time_allowed`, one attempt per session, ownership of `user_id`. Result percent on the UI = `obtain_marks / paper.total_marks`.

**6.5 Online exam list "open/closed".** Backend returns `active_exam` as the string `"yes"/"no"`; `app/exam/data/onlineExam.ts:191` does `Boolean(r.active_exam)` so **every** exam is treated as open and the Start button is enabled (`app/exam/online/page.tsx:157`).

**6.6 Practice / diagnostic submission (`/lms/submit-practice`).** Server-side `checkAnswer` is correct (compares posted answer ids to `answer_master.correct_answer=1`), then updates concept mastery + forgetting curve; but `student_id` comes from the request and the route has no middleware.

**6.7 LMS Exam page "Online Exam" tab.** `QuestionPaperView` (`app/lms/exam/page.tsx:738-770`) renders a textarea for every question and posts `answer_narrative[id]` only -> backend awards full `points` for any non-empty text, MCQs cannot be answered as MCQs.

**6.8 Homework lifecycle.** Assign (legacy `store`: unauthenticated; `submission_date` `nullable|string`, no date rule; attachment unrestricted) -> student submit (v2 `submit`: pinned to session student, files `pdf/jpg/png <= 10 MB`, status `Submitted`, AI job) -> staff review (`review-store`: status in `Under Review|Reviewed|Rejected`, per-question marks clamped to `[0,max_marks]`, `Reviewed` back-fills untouched questions with `COALESCE(ai_marks,0)`, `teacher_marks` = SUM(COALESCE(teacher, ai, 0))). No state-machine guard: `Reviewed -> Under Review -> Reviewed` allowed; resubmission blocked only while `Under Review|Reviewed`. No due-date enforcement on submit.

**6.9 Exam Evaluation (scanned sheets) publish.** `review` clamps marks to `[0,max]`, approve back-fills AI marks; `publish` replaces `lms_offline_exam` per `(paper,student,tenant,syear)`: `obtain_marks = (int) round(sum)` (fractional marks lost), `total_right` counts `marks>=max`, `total_wrong` counts **everything else including partial credit** while per-answer rows label partial as 'partial'. Unapproved sheets are silently skipped with a message. Whole flow is anonymous (LMS-05).

**6.10 AI question-paper generation (client-side).** Buckets per DOK and Bloom level (`aiPaper.ts`); `required = Math.round(total*pct/100)` per bucket (percentages 25x4 of 10 -> 3+3+3+3 = 12 > 10, later buckets starved silently while "availability" says OK); `marks = marksPerQuestion` **overrides** each question's `points`; `total_marks = count * marksPerQuestion`. Save posts `ai_generated`, distributions and `sections_config` but `ApiQuestionPaperController::store` persists none of them (fields list at lines 205-226) -> sections and distributions are lost; students are scored with `SUM(lms_question_master.points)` while the paper displays `total_marks` (two different maxima).

**6.11 Report card "Print mobile".** `handlePrintMobile` posts `html_<studentId>` (client DOM HTML) plus `total_working_day='0'`, `present_working_day='0'`, `student_percentage='0'` for **all selected students**; `save_result_html` runs `DB::table('result_reportcard_marks')->updateOrInsert(student, standard, term, syear)` with those three values for every student in the loop (LMS-12). HTML is stored in `result_html` and served to the mobile app.

**6.12 H5P attempt.** Question/answer payloads (including correctness) are sent to the browser; scoring, `percentage`, `passed`, retries and the MCQ "certificate" are computed and rendered client-side; the only outbound record is best-effort xAPI `{verb, success, response, duration}` to `/api/pal/h5p/xapi` (which updates BKT mastery/misconception when verb=`answered`). No score/attempt is persisted or read back (`content-type-list.tsx:85`). `scoreDragDropAttempt` guards `maxScore>=1`, other scorers guard `maxScore>0`; defaults differ (`pass_percentage ?? 100` in text-activity/drag-drop vs `|| 0` elsewhere).

**6.13 SQAA entry.** `mark` 0..4, per-document `availability in (yes,no,inprocess)`, file `mimes:pdf,xlsx,doc,docx` (no size), stored on public DigitalOcean space as `<docId>_<time>_<clientName>`; availability != yes deletes the stored file; transaction with rollback of uploaded files. Sound, but filename uses `getClientOriginalName()` unsanitised and objects are public-read.

**6.14 Course content upload.** Role gate = `strtoupper(request user_profile_name)` in `[TEACHER, LMS TEACHER, ADMIN, SUPER ADMIN]`; `link` any string <=2048 stored as `url`/`filename`, `file_type='link'`; non-presentation `filename` any file <=100 MB; on DB error the response echoes `debug_data => $content` and the exception message. Frontend renders `resolveViewableUrl()` which returns non-http candidates untouched -> used as `<iframe src>`/anchors.

---

## 7. Test / documentation coverage for your scope

Frontend tests in scope: **20 files, all pure `lib/` unit tests** - `lib/h5p/*.test.ts` (14) and `lib/question-paper/*.test.ts` (6). Not read; presence only. There are **zero** tests for: marks-entry percentage/grade helpers (`app/result/marks-entry`, `app/exam/marks-entry`), `lib/result/api.ts`, `lib/erp-client.ts`, online-exam data layer (`onlineExam.ts`, `Boolean(active_exam)` bug), AI paper distribution (`aiPaper.ts`), any page/component, route mapper (35 dead result mappings), teach-learn proxy, question-paper asset proxy (`isAllowedAssetUrl` is only tested indirectly via `images.test.ts` - NOT VERIFIED).
Backend tests touching scope: `tests/Unit/H5P{ContentType,DragQuestion,QuestionType,TextActivity}BuilderTest.php` (package builders), `tests/Feature/Pal/H5pFrontendTelemetryTest.php`, `PalInteractiveSubmissionTest`, `PalGradingIntegrityTest` (PAL). **No** Laravel tests for `onlineExamController`, `marks_entry_controller`, `classwiseGradeReportController`, `ApiQuestionPaperController`, `ApiLmsCourseController`, `StudentHomeworkApiController`, `HomeworkSubmissionApiController`, `ExamEvaluationApiController`, `SqaaApiController`, result API authz. (grep of `tests/` by controller/route names.)
Docs: `docs/h5p-content-types-2026-09-21.md`, `h5p-question-types-2026-09-21.md`, `h5p-drag-and-drop-integration.md` (sized only), `docs/LMS_CONTENT_ARCHITECTURE_BACKLOG_ACTION_PLAN.md` (status table: 9/11 done; renames "Teacher Workspace"/"Extension Activity" match the code labels I sampled). `app/result/README.md` exists (150 lines, not read). No documentation describes the auth model of the anonymous `/api/*` routes or that `LMS_API_AUTH_ENFORCE` is warn-only.

---

## 8. NOT VERIFIED items

1. Live value of `LMS_API_AUTH_ENFORCE` (and whether prod logs show anonymous traffic) - REASON: `.env` not readable; only config default (`false`) seen.
2. Whether `tblmenumaster.link` stores route names (`marks_entry.index`) or paths (`result/marks_entry`) - REASON: no DB access; decides whether the 35 dead `RESULT_ROUTE_NAME_MAP` entries (LMS-27) bite and whether `check_permissions` protects resource sub-routes (LMS-32).
3. Whether `result_marks`/`lms_online_exam` carry unique keys preventing duplicate rows - REASON: migrations drift from live DB (memory `gotcha_student_schema_drift`).
4. Whether `students-marks` filter `m.standard_id` exists on `result_marks` (`MigrationModulesApiController::studentMarks`) - REASON: schema not inspected.
5. Whether PHP executes files under `public/h5p_content`, `storage/app/public/student|upload_result` on the production web server - REASON: no server config. Determines RCE vs. hosted-content impact of LMS-15.
6. Whether DigitalOcean Spaces serves uploaded `.html/.svg` with an executable content-type on the public CDN - REASON: no bucket config.
7. Whether CSRF is actually bypassed for all web routes on the production host (full-URL wildcard entries in `VerifyCsrfToken::$except`) - REASON: static reading of `fullUrlIs/is` semantics; no runtime test.
8. Content of `H5PTextActivityController`, `H5PDragDropController`, `H5PMemoryGameController`, `H5PCoursePresentationController` sanitisation on save - REASON: not read; assumed same as base (no `strip_tags/purify` found by grep across `Http/Controllers/lms/h5p`).
9. Correctness of `RequireStaffRole` for parents whose profile names differ ("PARENT", "Parent Guardian") - REASON: tenant-authored free text; blocklist is exact `student|parent`.
10. Route-registration override semantics (later `Route::post('lms-assignment/...')` inside `api.session` groups replace earlier anonymous duplicates) - REASON: derived from Laravel `RouteCollection` behaviour (same method+URI key overwritten); not executed. If a route cache is stale the earlier anonymous route may still be live.
11. Rendering of the ~57 H5P pages and the 40 LMS pages beyond the sinks/endpoints listed - REASON: not read line by line (Section 1).
12. `app/api/proxy-file/route.ts` (not in scope files, unread) and PAL-owned endpoints reached by `pal/h5p` - REASON: other audit parts.

---

## 9. Second-pass results

Scope set: 345 `.ts/.tsx` files (excluding tests) across the scoped directories.

| Pattern | Hits | Files | Material hits |
|---|---:|---:|---|
| `TODO\|FIXME\|HACK\|XXX` | 1 | 1 | `app/course-master/data/chapters.ts:754` stale "TODO(backend): confirm the real store endpoint" while `PERSIST_ENABLED = true` at :818 and the endpoint is live (LMS-34). |
| `debugger` / `eval(` / `new Function` | 0 | 0 | clean. |
| `console.log/warn/error/debug` | 27 | 8 | `app/course-master/lesson-plan/[courseId]/page.tsx:955-1341` logs the whole `userData` object (token redacted, PII not) and API payloads; `sideDrawer.tsx:735-737` logs full AI prompts; `question-bank-library/debug.ts:95` (gated). |
| `localStorage/sessionStorage` | 63 | 29 | Session (token, tenant, user, profile, host_name) is read from `localStorage.userData/menuContext` in every data layer; role decisions (`isStudentSession`, `isStudentProfile`, `userProfileName()`) come from it; `host_name` becomes the API base URL (`lib/erp-client.ts`). |
| `dangerouslySetInnerHTML` | 19 | 13 | **Unsanitised DB HTML:** `h5p_flashacard/[id]/page.tsx:431`, `h5p_mcq/page.tsx:251,288,396,411,421`, `h5p_single_choice_set/[id]/page.tsx:115`, `h5p_true_false/[id]/page.tsx:104`, `scenario_based/[id]/page.tsx:231,272,304`, `components/h5p/players/EssayPlayer.tsx:83`, `lms/curriculum-planning/CurriculumTab.tsx:188`, `result/report-card/page.tsx:339`, `components/result/DynamicForm.tsx:245`. Sanitised: `h5p_course_presentation/[id]:310`, `h5p_image_hotspots/[id]:121` (DOMPurify), `course-master/[courseId]/chapters/page.tsx:6097` (`sanitizeGeneratedHtml`). `text_activity/player.tsx:619` deliberately avoids innerHTML. (LMS-14) |
| `<iframe` | 5 | 5 | `lms/exam/page.tsx:3369`, `_exam-evaluation/SheetReviewPanel.tsx:301`, `homework/review/[id]:267`, `homework/[id]:248`, `lmsAnnotate_assignment/[id]:184` - **no `sandbox` attribute**; `src` is a stored URL (LMS-21). `scenario_based` builds a YouTube iframe from a regex on stored HTML. |
| `postMessage` / `addEventListener('message')` | 0 | 0 | none - no origin-check surface. |
| `fetch(` | 173 | 50 | endpoint inventory in Section 5. Direct-to-Laravel with bearer + client tenant params; a minority go through `/api/proxy`. |
| `window.location` | 5 | 3 | `location.reload()` after save/generate in `course-master/.../page.tsx:3348`, `sideDrawer.tsx:930`, `exam/exam-master/page.tsx:195,224` (full reload instead of state refresh); no open-redirect. |
| `user_profile_name\|user_profile_id` | 69 | 22 | Sent as a request parameter on `lms-courses`, `question-paper`, `lms-homework/*`, content upload; backend uses it as the role (LMS-04/06/21). |
| `sub_institute_id` / `syear` | 226 / 194 | 49 / 55 | Always sourced from localStorage and sent to the API (Section 4). |
| `return []` | 72 | 35 | Mostly parser fallbacks; no placeholder-response stubs found. |
| `Math.random` | 12 | 10 | H5P shuffles (seeded `mulberry`-style) and `aiPaper.ts` shuffle; no security use. |
| `mock/hardcod/dummy/sample data` | 8 | 8 | `app/quiz/take/page.tsx:6` hard-coded quiz; `app/quiz/create/page.tsx:95-100` fake publish. |
| Hard-coded URLs/ids | - | - | `app/sqaa/_lib/api.ts:168` `https://s3-triz.fra1.digitaloceanspaces.com/public/sqaa/...`; `generated-html.ts:35` `.digitaloceanspaces.com`; Laravel: `term_id = 149`, grade ids 146-149, tenant 195, `sub_institute_id 1` platform tenant. |
| Emoji / gradients in shipped UI | - | - | `app/subjects/page.tsx:7` emoji array, `h5p_mcq/page.tsx:66-69` gradients (design-system says no gradients/emoji) - INFO. |
| Dead files | 1 | 1 | `app/course-master/page.redesign.tmp.tsx` (234 lines, unreferenced `*.tmp.tsx`). |

---

## 10. ISSUES

## LMS-01
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Exam / question paper (anonymous API)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiQuestionPaperController.php:71-73,118,152,173` (index) and `:391-420` (search); routes `D:\next_lms_erp\routes\api.php:460,489`. Frontend callers: `D:\lms_k12\app\exam\data\onlineExam.ts:listOnlineExams`, `app\lms\_shared\question-paper-grid.tsx`, `app\lms\exam\page.tsx`, `app\exam\data\progressReport.ts:162`.
**Function/Method:** `ApiQuestionPaperController::index`, `::search`
**Problem:** Two unauthenticated endpoints build SQL by string interpolation of request input.
**Evidence:** `$sub_institute_id = $request->input('sub_institute_id');` ... `"question_paper.sub_institute_id = $sub_institute_id"` -> `->whereRaw($sub_institute_id_by_lms)`. In `search`: `"qm.sub_institute_id = $sub_institute_id_for_query"` and `$extra .= " AND qm.chapter_id IN (" . implode(",", $search_chapter) . ")"` (same for `search_topic`) concatenated into `DB::select($sql, ...)`. No auth middleware; `api` group is `throttle:1000,1` only. (`ApiLmsCourseController` was already converted to bound parameters - this controller was missed.)
**Impact:** Anonymous read (boolean/time-based, possibly union) of the entire database - students, marks, credentials (plaintext staff passwords per project memory), other tenants. Pre-auth, internet-reachable.
**Expected Behavior:** Every input is bound or cast; endpoint requires a verified token and derives tenant from it.
**Recommended Fix:** Cast `(int)` and use `whereRaw('... = ?', [$id])`; bind `search_chapter/topic` via `whereIn`; put the whole `question-paper` resource behind `api.session` (+`staff.only` for writes); rotate anything exposed.
**Verification:** Request `POST /api/question-paper/search` with `search_chapter[]=0) OR 1=1-- ` on a non-prod copy; confirm 401/422 after the fix and add a feature test.

## LMS-02
**Severity:** Critical   **Type:** Confirmed
**Category:** Security
**Module:** Online exam result / attempt breakdown
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\onlineExamController.php:498-508` (`show`), `:544-553` (`online_exam_attempt`); frontend `D:\lms_k12\app\exam\data\onlineExam.ts:fetchExamResult`, `fetchAttemptBreakdown`.
**Function/Method:** `onlineExamController::show`, `::online_exam_attempt`
**Problem:** `online_exam_id` and `user_id`/`student_id` from the request are concatenated into `DB::select("... WHERE online_exam_id = '".$online_exam_id."' AND student_id = '".$user_id."' ...")`.
**Evidence:** `$user_id = $request->get('user_id') ?: $request->session()->get('user_id');` (line 440) then line 505 raw concatenation; `online_exam_attempt` builds further raw SQL from `lms_online_exam.student_id` values that were themselves stored from client input (second-order).
**Impact:** Any authenticated user (a student token suffices; the route only needs `session` middleware with `type=API`) can run arbitrary SELECTs, including cross-tenant data.
**Expected Behavior:** Parameterised queries; `user_id` from the token.
**Recommended Fix:** `DB::select($sql, [$online_exam_id, $user_id])`, cast ids, take `user_id` from `session('user_id')` for students, add ownership check.
**Verification:** Call `GET /lms/online_exam/1?type=API&online_exam_id=1' OR '1'='1&user_id=x` on a test DB; regression test with a student token.

## LMS-03
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Result (all masters, marks, reports, uploads)
**Location:** `D:\next_lms_erp\routes\resultapi.php:52-245` (`middleware => ['api.session']` only); `D:\next_lms_erp\app\Http\Controllers\result\ExamMaster\ExamMasterController.php:167,181`, `ExamTypeMaster/ExamTypeMasterController.php:103,117`, `exam_creation/exam_creation_controller.php:300,328`, `GradeMaster/GradeMasterController.php:98`, `co_scholastic/co_scholastic_controller.php:265,285`, `co_scholastic_master_controller.php:178,200`, `result_master_controller.php:298,318`, `result_remark_master_controller.php:144,165`, `new_result/templateController.php:164,179`, `result_book_master_controller.php:253,300`, `result_activity_masterController.php:220`, `resultSkillsetController.php:179`, `working_day_master_controller.php:155`. Frontend: no gating in `app/result/**` (Section 3).
**Function/Method:** `*ApiController::{store,update,destroy,bulkDestroy}` delegating to the legacy controllers
**Problem:** (a) No role/permission check on any `api/result/*` route: a student or parent token can create/edit/delete exam masters, exams, grade scales, result templates, approve marks. (b) Update/delete use the bare primary key with no `sub_institute_id` constraint (`ExamMaster::where(["Id" => $id])->delete()`), so any authenticated user of any school can modify or delete another school's rows by iterating ids. The legacy web routes were protected by `check_permissions`; the API wrapper bypasses it.
**Evidence:** `BaseResultApiController` docblock: "delegates to the existing web controllers"; `grep is_student|user_profile_name|checkPermission` in `api/result/*` finds only `DropdownApiController` (list narrowing). `ExamMasterController::destroy`: `ExamMaster::where(["Id" => $id])->delete();` `exam_creation_controller::destroy`, `GradeMasterController::destroy` identical.
**Impact:** Destructive cross-tenant data loss and grade/exam tampering by any logged-in student or parent; integrity of every result in the platform.
**Expected Behavior:** Staff-only (plus menu rights) on result mutation; every write scoped by tenant (and syear where applicable).
**Recommended Fix:** Add `staff.only` + `check_permissions` (or `RequirePermission`) to the `api/result` group, and add `->where('sub_institute_id', session('sub_institute_id'))` to every `find/update/delete` by id; add tenant-isolation tests.
**Verification:** With a student JWT, `DELETE /api/result/exam-master/{id-of-other-school}`; expect 403 after the fix.

## LMS-04
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Question papers, question bank, course structure & content authoring (Exam, Course Master, H5P question bank, Subjects, Quiz, Chapters)
**Location:** `D:\next_lms_erp\routes\api.php:217-227,236,254,264,460,489` (no auth middleware); `ApiQuestionPaperController.php:191-362`; `ApiLmsCourseController.php:2126-2530,804,1101,1541-1720`; frontend `D:\lms_k12\app\course-master\data\lmsCourses.ts:87`, `chapters.ts:862,1186,1232,1273,1303,1328`, `app\exam\data\aiPaper.ts:225,401`, `app\quiz\_lib\quiz-api.ts:60`, `app\h5p\data\question-bank-library.ts:116`.
**Function/Method:** `ApiQuestionPaperController::{store,update,destroy,show}`, `ApiLmsCourseController::{createQuestionBank,updateQuestionBank,deleteQuestionBank,reviewQuestionBank,storeChapter,storeSubject,persistContent}`
**Problem:** These routes are registered at file level with no `api.session`/`lms.auth`. Tenant, user and **role** come from the request body: `persistContent` gates on `strtoupper($request->input('user_profile_name'))`; `deleteQuestionBank`'s tenant guard compares the chapter owner to the **caller-supplied** `sub_institute_id`. The frontend sends **no Authorization header** for `fetchLmsCourses` and the chapter/question-bank calls (`lmsCourses.ts:88`, `chapters.ts:862`).
**Evidence:** `Route::apiResource('question-paper', ApiQuestionPaperController::class);` (routes/api.php:460); `$user_profile_name = trim((string) ($request->input('user_profile_name') ?: $this->sessionValue(...)))` + `in_array($contentRole, ['TEACHER','LMS TEACHER','ADMIN','SUPER ADMIN'])`; `ApiQuestionPaperController::destroy`: `questionpaperModel::where(["id" => $id])->delete()` with no tenant filter; `show()` returns every question row and `answer_arr` with `correct_answer`.
**Impact:** Anonymous create/overwrite/delete of any school's exam papers, question bank items, chapters, subjects and content; anonymous reading of full question banks with answer keys; students can fetch answer keys for any paper.
**Expected Behavior:** Authenticated, tenant-from-token, role-checked (teacher/admin) authoring; students never receive answer flags outside a graded review.
**Recommended Fix:** Wrap in `['api.session','staff.only']` (or turn on `lms.auth` enforcement + `perm:`), read tenant/user/profile from the session only, scope every by-id write with the token tenant, strip `correct_answer` from student-facing payloads, and make the frontend send the bearer token on every call.
**Verification:** Unauthenticated `POST /api/question-paper` and `POST /api/lms-question-bank/delete` must return 401; add negative tests per role.

## LMS-05
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** LMS Exam Operations - Exam Evaluation, Blueprints, Templates
**Location:** `D:\next_lms_erp\routes\api.php:496-541`; `ExamEvaluationApiController.php:44,78,119,181,219,294,361,474,498,519,549,600` (`$tenantId = (int) $request->input('sub_institute_id')`); frontend `D:\lms_k12\app\lms\exam\_exam-evaluation\api.ts`, `_assessment-blueprint\api.ts`, `_question-paper-templates\api.ts`.
**Function/Method:** `ExamEvaluationApiController::{store,uploadSheets,review,publish,destroy}`, `AssessmentBlueprintApiController::*`, `QuestionPaperTemplateApiController::*`
**Problem:** The whole feature - upload scanned answer sheets, edit teacher marks, approve, **publish into the gradebook (`lms_offline_exam`, `lms_offline_exam_answer`)**, delete batches/sheets, edit blueprints/templates - is anonymous with tenant, `user_id` (`created_by`, `approved_by`) and `syear` from the body.
**Evidence:** No `Route::middleware` around lines 496-541; `publish()` deletes and re-inserts `lms_offline_exam` rows for `(question_paper_id, student_id, sub_institute_id, syear)` from the batch; `sheet file` route `exam-evaluation/sheets/{id}/file` returns the stored scan for any `sub_institute_id` value the caller supplies.
**Impact:** Anyone can forge or wipe published exam marks for any school, read scanned answer sheets (student PII/handwriting), and attribute approvals to arbitrary users.
**Expected Behavior:** `api.session`+`staff.only` (and teacher-of-subject scoping), tenant/user from token, audit log of approvals.
**Recommended Fix:** Group the 40+ routes under `['api.session','staff.only']`, replace `$request->input('sub_institute_id')` with `session('sub_institute_id')`, take `user_id` from the session, restrict `file` to the owning tenant.
**Verification:** Curl `POST /api/exam-evaluation/batches/1/publish` with no token; expect 401. Cross-tenant batch id with a valid token; expect 404.

## LMS-06
**Severity:** Critical   **Type:** Confirmed
**Category:** Authorization
**Module:** Legacy homework family, lesson planning/intelligence, concept-intelligence, teacher-resource, lookups, H5P AI
**Location:** `D:\next_lms_erp\routes\api.php:271-286` (legacy `lms-homework/*`), `:583-627` (`intelligence/*`, `lesson-intelligence/*`), `:670-676` (tab-labels), `:262-266`; `routes\lms.php:551-552,578-584`; `routes\result.php:136-154`; `StudentHomeworkApiController.php:93-405,696-733,807-927`; `LessonIntelligenceApiController.php:dropdowns`; `LessonPlanPeriodApiController.php`; frontend `D:\lms_k12\app\lms\homework\api.ts:378,418`, `app\lms\lesson-plan\page.tsx:644-830`, `app\lms\monthly-plan\page.tsx:565-783`, `app\course-master\lesson-plan\[courseId]\LessonIntelligencePanel.tsx:154`.
**Function/Method:** `StudentHomeworkApiController::{store,update,destroy,bulkDelete,submissionStore,submissionReport}`, `LessonPlanPeriodApiController::{store,update,destroy}`, `LessonIntelligenceApiController::{dropdowns,storeMicroPlan*}`, `AJAXController::get*List`
**Problem:** Unauthenticated endpoints with client-supplied identity. Examples: `lms-homework/bulk-delete` applies tenant/year filters only `->when($sub_institute_id, ...)`, so omitting them deletes any homework row by id; `submissionStore` lets anyone mark any homework "submitted" and upload a file; `GET/POST /api/lesson-intelligence/dropdowns` returns **every school** (`school_setup` id + name); `micro-plan/*` triggers billable DeepSeek calls; `get-h5p-ai-scenario` calls OpenRouter with the platform key; `/api/get-*-list` and `lms/api/teacher_resource/*` read tenant from the request.
**Evidence:** `Route::post('lms-homework/list', ...)` etc. declared at file level with no middleware; `$deleted = DB::table('homework')->whereIn('id', $ids)->when($sub_institute_id, ...)->when($syear, ...)->delete();`; `DB::table('school_setup')->orderBy('SchoolName')->get(['Id as id','SchoolName as name'])`. Role for `index()` is `$request->input('user_profile_name')`.
**Impact:** Anonymous destructive writes/deletes, tenant enumeration (recon for every other bug here), LLM cost abuse, homework tampering.
**Expected Behavior:** All LMS APIs behind `api.session` with tenant/user/role from the token; LLM routes rate-limited per user.
**Recommended Fix:** Move the legacy homework routes to the v2 authenticated controller or wrap them in `api.session`+`staff.only`; require tenant from the session; delete or protect `dropdowns`; put AI routes behind `api.session`+`throttle`.
**Verification:** Unauthenticated calls to each listed route must return 401; `dropdowns` must not enumerate schools.

## LMS-07
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Online exam scoring
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\onlineExamController.php:151-153,181-183,209,282-334`; frontend `D:\lms_k12\app\exam\data\onlineExam.ts:229,270-277`, `app\exam\online\[paperId]\page.tsx:257`
**Function/Method:** `onlineExamController::store`, `::get_calculate_marks`, `::getData`
**Problem:** Grading trusts the client. Each option's value is posted as `"<answerId>##<correct_flag>"` and the server marks "right" when the posted flag is 1. `getData()` sends every `answer_master` row (with `correct_answer`) to the browser first. Narrative answers are "right" whenever non-empty. Multi-answer: right if all correct ids appear among ids the client flagged 1; extra wrong selections are ignored and `$given_ans_arr` is not reset between questions.
**Evidence:** `$single_ans_arr = explode("##", ...); if ($single_ans_arr[1] == 1) { $ans_status = "right"; }`; `$right_narrative_ans++` for `isset($narrative_answer) && $narrative_answer != ""`; `$diff = array_diff($original_ans, $given_ans_arr); if (count($diff) == 0) { right }`; frontend `value = \`${option.id}##${option.correctFlag}\``.
**Impact:** Any student can score 100% by editing the form (or reading the flags in the payload); honest students get full marks on MCQs by selecting all options; typing "x" earns narrative marks.
**Expected Behavior:** Server ignores the flag, looks up `answer_master.correct_answer` per answered id, applies a penalty/exact-match rule, and does not ship answer keys during an attempt; narrative questions require teacher marking.
**Recommended Fix:** Post only answer ids; grade server-side from `answer_master`; require exact set equality for multi-select; hide `correct_answer` until submission (respecting `result_show_ans`); queue narrative for manual grading.
**Verification:** Submit `answer_multiple[q][]=<wrongId>##1` -> must be scored wrong; add unit tests for single, multi, narrative.

## LMS-08
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Online exam windows / attempts / time limit
**Location:** `D:\lms_k12\app\exam\data\onlineExam.ts:191`, `app\exam\online\page.tsx:129-166`; `D:\next_lms_erp\app\Http\Controllers\api\ApiQuestionPaperController.php:100,148,169` and `onlineExamController.php:105-268`
**Function/Method:** `listOnlineExams`, `onlineExamController::store/getData`
**Problem:** (1) Backend returns `active_exam` as the strings `"yes"/"no"`; the frontend does `Boolean(r.active_exam)` so `"no"` is truthy: every exam shows "Open" and the Start button is enabled. (2) The server never checks `open_date/close_date`, `attempt_allowed`, `time_allowed`, or that `hid_session_quiz` (client start time) is plausible; each POST inserts a new attempt. (3) The client timer (`setTimeLeft`) is the only time limit. (4) No idempotency: a retry after a lost response records a duplicate attempt.
**Evidence:** `activeExam: Boolean(r.active_exam)` vs SQL `if(now() between open_date and close_date,"yes","no") as active_exam`; `store()` contains no window/attempt logic although `question_paper.attempt_allowed` is stored by `ApiQuestionPaperController::store`.
**Impact:** Closed exams can be started and submitted; unlimited retakes; time limit bypass; inflated attempt averages in the results dashboard (it averages attempts).
**Expected Behavior:** Server enforces window, attempt count and duration; UI reflects server truth.
**Recommended Fix:** Compare with `=== 'yes'`; in `store` reject outside window/over attempts/late (`now() - start > time_allowed + grace`) and issue a server-side attempt token at load time.
**Verification:** POST to `lms/online_exam` for a closed paper and a 2nd attempt with `attempt_allowed=1`; expect 403/422.

## LMS-09
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Online exam / practice / student report (identity & tenant from request)
**Location:** `onlineExamController.php:112-113,440-441`; `assessmentQuestionController.php:submitPractice (student_id, sub_institute_id from request)`, routes `routes\web.php:91-113`; `lms\reports\studentReportController.php:54-66`; frontend `D:\lms_k12\app\exam\data\onlineExam.ts:273,300,318`, `app\lms\exam\page.tsx:1942-1955`
**Function/Method:** `store`, `show`, `online_exam_attempt`, `submitPractice`, `studentReportController::edit`
**Problem:** After the `session` middleware hydrates a verified identity, these controllers still use `$request->get('user_id') ?: session` / `$request->input('sub_institute_id') ?: session`, i.e. **request wins**. `submit-practice`, `student-profile`, `class-insights`, `teacher-dashboard` are top-level `web.php` routes with no middleware at all and take `student_id` from the request.
**Evidence:** `$user_id = $request->get('user_id') ?: $request->session()->get('user_id');`; `$sub_institute_id = $request->input('sub_institute_id') ?: $request->session()->get('sub_institute_id');` `getStudents([$id], $sub_institute_id, $syear)` with `$id` from the URL.
**Impact:** Student A can submit an exam/practice as B, read B's result and per-concept analysis, or another school's student report (`lmsStudent_report/{id}/edit`); mastery/forgetting-curve rows for any `student_id` can be written anonymously.
**Expected Behavior:** Students act only as themselves; staff limited to their tenant (and classes).
**Recommended Fix:** Invert the precedence (session first, request ignored for identity), add ownership checks for students, put the `web.php` pedagogy routes under `session`+`check_permissions`.
**Verification:** With student token A call `GET /lms/online_exam/{paper}?user_id=B&online_exam_id=...`; expect 403.

## LMS-10
**Severity:** High   **Type:** Confirmed
**Category:** Frontend
**Module:** LMS Exam page - student "Online Exam" tab
**Location:** `D:\lms_k12\app\lms\exam\page.tsx:738-770,880-905,2804-2812`
**Function/Method:** `QuestionPaperView`, `handleSubmitExam`
**Problem:** The component renders a free-text `<textarea>` for every question (including MCQ/True-False) and posts only `answer_narrative[<id>]`. Because the backend treats any non-empty narrative as correct (LMS-07), this path awards full points for any text, and MCQ options are never shown. It duplicates (and contradicts) the correct MCQ UI in `/exam/online/[paperId]`.
**Evidence:** `formData.append(\`answer_narrative[${question.id}]\`, answers[question.id] ?? '')`; textarea `name={\`answer_${question.id}\`}` with no option rendering.
**Impact:** Wrong marks recorded for every student who uses this tab; MCQ exams effectively un-takeable here.
**Expected Behavior:** One online-exam implementation that renders question types and posts answer ids.
**Recommended Fix:** Replace `QuestionPaperView` with a redirect to `/exam/online/{paperId}` (after fixing LMS-07/08) or reuse its player component.
**Verification:** Open a MCQ paper in `/lms/exam` as a student; options must render and answers must post as ids.

## LMS-11
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Result - marks entry & approval
**Location:** `D:\next_lms_erp\app\Http\Controllers\result\marks_entry\marks_entry_controller.php:48-90,598-792`; frontend `D:\lms_k12\app\result\marks-entry\page.tsx:84-116,204-232,304`, `app\exam\marks-entry\page.tsx:159-215`
**Function/Method:** `marks_entry_controller::store`, `::approve`; `calculatePercentage`, `findGrade`, `isValidMark`
**Problem:** (1) `points`, `per`, `grade` are client-computed and stored verbatim; no `points <= result_create_exam.points`, negatives accepted, `student_id`/`exam_id` not tied to tenant/class/subject. (2) The "approved = locked" rule exists only in the UI (`disabled={saving || approving || approved}`); `store()` checks `ResultLock::isLocked` but never `result_exam_approve`. Any role can approve/unapprove. (3) Blank `points` is silently skipped while the response says "Data Saved/Updated" (a mark cannot be cleared). (4) `$res` is overwritten in the loop so only the last student's status is returned; per-row exceptions are swallowed. (5) The client caps entry at `Math.min(maxMarks, 500)` (`page.tsx:86`), blocking legitimate maxima > 500. (6) The menu entry (path-form link) routes to the legacy `/exam/marks-entry`, which has no approval/lock UI at all.
**Evidence:** `if ($arr['points'] != '') { ... }` update/insert; `$data = ['points' => $arr['points'], 'per' => $arr['per'], 'grade' => $arr['grade'], ...]`; `grep result_exam_approve` shows only `approve()/create()`; UI: `disabled={saving || approving || approved}`.
**Impact:** Forged percentages/grades, edits after approval, silent partial saves, data attributed to the wrong class/tenant.
**Expected Behavior:** Server recomputes per/grade from points and the standard's grade scale, validates ranges, enforces approval lock and teacher-class assignment, returns per-row results.
**Recommended Fix:** Move calculation server-side; validate; check `result_exam_approve.status` in `store`; restrict approve to configured roles; return an aggregated status; retire `/exam/marks-entry`.
**Verification:** POST `values[7][points]=9999&per=100&grade=A+` -> 422; save after approve -> 423.

## LMS-12
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Result - New report card "Print mobile"
**Location:** `D:\lms_k12\app\result\report-card\page.tsx:189-213` (`total_working_day: '0'`, `present_working_day: '0'`, `student_percentage: '0'`, `html_<id>` from DOM); `D:\next_lms_erp\app\Http\Controllers\result\new_result\studentResultController.php:7389-7449` (`save_result_html`); `api\result\StudentResultApiController::saveHtml`
**Function/Method:** `handlePrintMobile`, `save_result_html`
**Problem:** The screen hard-codes three attendance/percentage fields to `'0'` and the backend applies those request-level values to **every** selected student via `DB::table('result_reportcard_marks')->updateOrInsert([student, standard, term, syear], ['total_working_day' => $working, 'present_working_day' => $present, 'student_percentage' => $percentage])`. It also stores client-supplied HTML (`html_<id>`) into `result_html`, which the mobile app renders.
**Evidence:** `$working = $request->get('total_working_day') ?? 0; ... updateOrInsert(... 'student_percentage' => $percentage ...)` inside `foreach ($student_array ...)`.
**Impact:** One click overwrites real attendance and percentage of the whole class with 0 (data destruction, wrong report cards/ranks downstream); a staff user (or any student via LMS-03) can publish forged report-card HTML to parents' app.
**Expected Behavior:** Attendance/percentage computed server-side per student; HTML generated server-side, not accepted from the client.
**Recommended Fix:** Remove the three fields from the payload and the write from `save_result_html` (or compute per student), generate HTML on the server from the template, sanitise, and limit to staff.
**Verification:** After "Print mobile" for 2 students with existing attendance, values in `result_reportcard_marks` must be unchanged.

## LMS-13
**Severity:** High   **Type:** Confirmed
**Category:** Business Logic
**Module:** Result - classwise grade report / rank
**Location:** `D:\next_lms_erp\app\Http\Controllers\result\classwiseGradeReportController.php:323-390` (esp. `:327 $term_id = 149;`), `:160-165,178`
**Function/Method:** `getRank`, `index/show`
**Problem:** When `type == 'API'` (which every Next.js call is) `getRank` reads `syear` and `sub_institute_id` from `$_REQUEST` and **overwrites `$term_id` with the constant 149**, so rank/percentage/failed-count for any tenant/term is computed against term 149 (a single school's id). It is also executed once per student per exam title (N x M full-class aggregate queries).
**Evidence:** `if ($type == 'API') { $syear = $_REQUEST['syear']; $sub_institute_id = $_REQUEST['sub_institute_id']; $term_id = 149; }`.
**Impact:** Wrong or empty ranks and "excellent/fair" remarks in the classwise report for every school except one; client-controlled tenant/year in a report query; slow report on large classes.
**Expected Behavior:** Use the requested term and the session tenant/year; compute the ranking once per exam.
**Recommended Fix:** Remove the constant, use the passed `$term_id` and session values, hoist `getRank` out of the student loop (compute once per exam title, index by student).
**Verification:** Compare API vs web output for a non-149 term; add a unit test with two terms.

## LMS-14
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** H5P playback, curriculum planning, report card, result templates
**Location:** `D:\lms_k12\app\h5p\h5p_flashacard\[id]\page.tsx:431`; `app\h5p\h5p_mcq\page.tsx:251,288,396,411,421`; `app\h5p\h5p_single_choice_set\[id]\page.tsx:115`; `app\h5p\h5p_true_false\[id]\page.tsx:104`; `app\h5p\scenario_based\[id]\page.tsx:231,272,304`; `components\h5p\players\EssayPlayer.tsx:83`; `app\lms\curriculum-planning\CurriculumTab.tsx:188`; `app\result\report-card\page.tsx:339`; `components\result\DynamicForm.tsx:245`. Backend: no sanitisation in `D:\next_lms_erp\app\Http\Controllers\lms\h5p\*` (grep `strip_tags|purif|htmlspecialchars` only finds emptiness checks) or in `Services\lms\H5P\*Package*` import.
**Function/Method:** `Html` helper components, flashcard/MCQ/essay renderers
**Problem:** Author-supplied HTML (flashcard `content`, question/answer text, statements, scenario descriptions, essay prompts, curriculum "details", generated report-card HTML, template preview) is injected with `dangerouslySetInnerHTML` un-sanitised and shown to students/parents/staff. It reaches the DB from teachers, from `.h5p` package import, and - because H5P writes have no role check (LMS-17) - from students. Two H5P pages (`course_presentation`, `image_hotspots`) and the chapter generator do use DOMPurify, showing the gap is inconsistent, not by design.
**Evidence:** `dangerouslySetInnerHTML={{ __html: card.content }}`; `function Html({ html }) { return <span dangerouslySetInnerHTML={{ __html: html }} /> }` with comment "stored as HTML, because H5P stores them so"; `dangerouslySetInnerHTML={{ __html: reportHtml }}` where `reportHtml` is backend template output.
**Impact:** Stored XSS executing in the app origin: the JWT and PII are in `localStorage`, so account takeover of teachers/admins viewing student-authored or imported content.
**Expected Behavior:** All HTML from the DB goes through one sanitiser (allow-list), on read and on write.
**Recommended Fix:** Reuse `app/components/questionBank/RichText.tsx`/`sanitizeGeneratedHtml` for every sink; sanitise server-side on store/import (e.g. `mews/purifier`); escape template variables in result HTML.
**Verification:** Store `<img src=x onerror=alert(1)>` in a flashcard and MCQ option; it must render inert.

## LMS-15
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** File uploads (H5P, homework, result, course content)
**Location:** `H5PScenarioController.php:53-100` (image: only `isValid()`), `H5PContentTypeController.php:409-441` (extension from `getClientOriginalExtension()`), `H5PInteractiveVideoController.php:45-90` (same), `StudentHomeworkApiController.php:160-170,807-840` and `HomeworkSubmissionApiController.php:272-320` (`File::extension($client name)`), `upload_result_controller.php:148-157` + `UploadResultApiController.php:79` (`image.* => file`), `ApiLmsCourseController.php:1544,1602` (`filename => nullable|file|max:102400`), `SqaaApiController` (`getClientOriginalName()` in key)
**Function/Method:** `H5PScenarioController::store`, `H5PContentTypeController::media`, `StudentHomeworkApiController::store/submissionStore`, `upload_result_controller::store`, `persistContent`
**Problem:** Stored file names use the client-supplied extension/name and several endpoints validate nothing (scenario image, result upload, content upload). `mimes:` validates by content-guess, so a valid PNG/PDF polyglot named `x.php` keeps the `.php` extension. Local fallbacks write into `public/h5p_content` (web-served), `storage/app/public/student|upload_result`.
**Evidence:** `$newfilename = 'scenario_' . date(...) . '.' . $file->getClientOriginalExtension();` after `if (!$file || !$file->isValid()) return "Invalid file";`; `$ext = File::extension($originalname); $file_name = $name.'.'.$ext; $file->storeAs('public/upload_result/', $file_name);`.
**Impact:** Depending on server config (NOT VERIFIED) remote code execution via uploaded `.php`, or stored XSS/phishing hosting via `.html/.svg` on the public bucket; reachable by students for H5P/result upload routes (LMS-03/17).
**Expected Behavior:** Whitelist by detected MIME, generate extension server-side, random names, size limits, non-executable storage.
**Recommended Fix:** Derive extension from `$file->guessExtension()` against an allow-list, validate every upload (`mimes`, `max`), store outside web root or serve with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
**Verification:** Upload `x.php` (valid GIF header) to `POST /h5p/scenario_based` and `/api/result/upload-result`; must be rejected or stored with a safe extension.

## LMS-16
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** H5P package export
**Location:** `D:\next_lms_erp\app\Services\lms\H5P\H5PPackageArchive.php:184-208,284-300`; `H5PImageHotspotsController.php:116` (`'background_image' => 'required|string|max:2048'`) and equivalents
**Function/Method:** `H5PPackageArchive::readMedia`, `packMediaUsing`, `H5PContentTypeController::export`
**Problem:** Media references are free strings. On export `readMedia($source)` tries `public_path(ltrim(parse_url($source, PHP_URL_PATH) ?: $source, '/'))` (no realpath/containment check, so `../../.env` resolves) and, for `http(s)` sources, `file_get_contents($source)` (SSRF, no allow-list). The bytes are bundled into the `.h5p` archive that is returned to the caller.
**Evidence:** `$localCandidate = public_path(ltrim($path, '/')); if (is_file($localCandidate) && is_readable($localCandidate)) { $bytes = @file_get_contents($localCandidate); ... }`; `mediaFilename()` keeps the source's extension (e.g. `.env`).
**Impact:** Any user who can create an H5P item can read arbitrary server files (env, keys) or probe internal HTTP services and download the result.
**Expected Behavior:** Only files under the H5P upload directory or allow-listed hosts are bundled.
**Recommended Fix:** `realpath()` containment under `public_path('h5p_content')`; validate media URLs against the storage origin on save (`url` rule + host allow-list); block private IP ranges for remote fetch.
**Verification:** Save `background_image=../../.env`, export; archive must not contain it.

## LMS-17
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** H5P authoring endpoints
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\h5p\H5PContentTypeController.php:214-400` (no role check), `H5pFlashcardController.php:158-336` (`h5pFlashcard::findOrFail($id)`), `H5PInteractiveVideoController.php:45-70,166-350` (`request` tenant in API branch; unscoped `findOrFail`, `deletePoint` `find($id)`), `H5PScenarioController.php:53-60,288-330`; `routes\lms.php:439-546`; frontend gating `D:\lms_k12\app\h5p\data\h5p.ts:57` (`isStudentProfile()`)
**Function/Method:** `store/update/destroy/publish/duplicate/import/media`, legacy CRUD
**Problem:** Create/edit/delete/publish/import/media are available to any authenticated profile including students; only draft visibility is role-aware on reads. Legacy controllers accept `sub_institute_id`/`user_id`/`syear` from the request (overriding the token) and look up flashcards, videos and points by id with no tenant filter. Route names (`h5p_true_false.store`) may not match any `tblmenumaster.link`, in which case `check_permissions` does not apply (NOT VERIFIED, LMS-32).
**Evidence:** `if (in_array($type, ['API','JSON'])) { $sub_institute_id = $request->sub_institute_id; $syear = $request->syear; $user_id = $request->user_id; ...` (video store); `$video = H5pInteractiveVideo::findOrFail($id);`.
**Impact:** Students can publish or delete activities; cross-school modification/deletion of interactive content; content authored under a forged tenant.
**Expected Behavior:** Staff-only writes, tenant-scoped everywhere.
**Recommended Fix:** Add a shared `staff.only` (or `RequirePermission`) to the `h5p` route group, use `findForTenant` in legacy controllers, ignore request tenant/user.
**Verification:** Student token `DELETE /h5p/h5p_interactive_video/{other-school-id}` -> 403/404.

## LMS-18
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Homework v2 review / files
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\lms\HomeworkSubmissionApiController.php:160-176 (detail),378-424 (reviewList),425-450 (reviewDetail),455-520 (reviewStore),672-715 (downloadFile)`
**Function/Method:** `reviewList`, `reviewDetail`, `reviewStore`, `downloadFile`, `detail`
**Problem:** (1) `reviewList` scopes by tenant/year only `->when(request value)`; a staff caller who omits them lists every school's submissions and AI scores. (2) `reviewDetail`/`reviewStore`/`downloadFile` use `studentHomeworkModel::find($id)` with no tenant or class scoping; `reviewStore` records `reviewed_by` from the request body and can grade any school's submission. (3) `downloadFile` (any authenticated student) has no ownership check; composite ids `"{homeworkId}_{index}"` are guessable and files sit at predictable `/storage/homework_submissions/{id}/...` URLs. (4) `detail` filters tenant with the request value. (5) No due-date enforcement in `submit`.
**Evidence:** `->when($sub_institute_id, fn ($q) => $q->where('h.sub_institute_id', $sub_institute_id))`; `$homework = studentHomeworkModel::find($id);` `$reviewed_by = $request->input('user_id') ?? $request->input('teacher_id');`.
**Impact:** Cross-tenant disclosure/modification of student work and marks; forged reviewer attribution.
**Expected Behavior:** Tenant from session on every query, teacher scoped to assigned classes, student files only for the owner.
**Recommended Fix:** Add `->where('sub_institute_id', session('sub_institute_id'))` everywhere, ownership check in `downloadFile`, `reviewed_by = session('user_id')`, enforce deadline/status transitions.
**Verification:** Student B requests `submission-file/{A's homework}_0` -> 403; staff review of other-tenant id -> 404.

## LMS-19
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Teach/Learn Next.js proxy
**Location:** `D:\lms_k12\app\api\teach-learn\menu-categories\route.ts:45-100`; caller `D:\lms_k12\app\teach-learn\_lib\teach-learn-menu-categories-api.ts:45`
**Function/Method:** `GET` handler
**Problem:** The unauthenticated Next route uses the **request header** `x-laravel-base-url` as the upstream origin, forwards `Authorization: Bearer <x-laravel-token>` and the caller's `Cookie` to it, and returns either the parsed JSON or a 500-char preview of any non-JSON body.
**Evidence:** `const baseUrl = readHeader(request, 'x-laravel-base-url') || getDefaultBaseUrl(); ... fetch(url.toString(), { headers: { Authorization: Bearer ..., Cookie: ...}})` and `preview: summarizeHtml(text)`.
**Impact:** Anyone who can reach the Next.js server can make it issue GET requests to arbitrary hosts from the app's network (cloud metadata, internal services) and read a 500-character preview of text/HTML responses; the route also becomes a generic open relay. (A victim's own token/cookie is only sent to an attacker host if the victim's browser is made to send the attacker-chosen header, which is not practical, so token theft is not the main risk.) The route comment "upstream runs no session middleware" is stale: the Laravel route is `api.session`+`check_permissions` (`routes/api.php:204`).
**Expected Behavior:** Upstream fixed by server config; headers never choose the host.
**Recommended Fix:** Drop `x-laravel-base-url`; use `API_BASE_URL`; require an Authorization header and validate it; remove the HTML preview.
**Verification:** Send `x-laravel-base-url: http://169.254.169.254` and expect 400.

## LMS-20
**Severity:** High   **Type:** Confirmed
**Category:** Authorization
**Module:** Learning Outcome (migration-modules API)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\MigrationModulesApiController.php:16-71`; frontend `D:\lms_k12\app\migration-modules\MigrationModulePage.tsx`, `app\learning-outcome\*`
**Function/Method:** `guard`, `index/store/destroy`, `studentMarks`
**Problem:** `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. `learning-outcomes` (`learning_outcome_indicator`) and `indicator-mappings` are read and deleted with **no tenant filter**; `students-marks` returns first/last name and `result_marks` rows for any tenant id supplied (`where s.sub_institute_id = <request>`), reachable by any student token. The UI only lists rows (no create/edit UI) so `store/destroy` are backend-only.
**Evidence:** `private function tenant(Request $r): int { return $r->integer('sub_institute_id'); }`; `'learning-outcomes' => $this->ok(['records'=>DB::table('learning_outcome_indicator')->orderByDesc('ID')->get()])`; delete `$q = DB::table($table)->where('id', $id)` with tenant filter only for four other modules.
**Impact:** Cross-tenant read of students' marks and learning-outcome master data, cross-tenant delete of master rows.
**Expected Behavior:** Token tenant, role check, tenant filter on every table that has one.
**Recommended Fix:** Use `session` tenant after `api.session`, add `staff.only`, filter/scope `learning_outcome_*` by tenant column, and either build the create/edit UI or remove the write endpoints.
**Verification:** Student token `GET /api/migration-modules/students-marks?sub_institute_id=<other>` -> 403.

## LMS-21
**Severity:** High   **Type:** Confirmed
**Category:** Security
**Module:** Course Master content (links)
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiLmsCourseController.php:1541-1560,1579-1600`; `D:\lms_k12\app\course-master\data\content-links.ts:resolveViewableUrl`; iframe sinks `app\lms\exam\page.tsx:3369`, `app\lms\homework\[id]\page.tsx:248`, `homework\review\[id]\page.tsx:267`, `lmsAnnotate_assignment\[id]\page.tsx:184`, `_exam-evaluation\SheetReviewPanel.tsx:301`
**Function/Method:** `resolveContentMedia`, `persistContent`, `resolveViewableUrl`
**Problem:** The `link` field is stored as `url`/`filename` after only `nullable|string|max:2048`; `resolveViewableUrl` returns non-`http` candidates untouched ("Relative paths and anything else non-http are handed back untouched"), and the URL is used as `<iframe src>`/`<a href>`. `javascript:` (or `data:text/html`) URLs execute in the app origin. None of the iframes carry `sandbox`. The role gate is the client-supplied `user_profile_name` on a route that is anonymous while `LMS_API_AUTH_ENFORCE` is false, so anyone can plant such a link on any chapter.
**Evidence:** `'link' => 'nullable|string|max:2048'`; `return candidates.find((value) => typeof value === 'string' && value.trim() !== '') ?? undefined;`.
**Impact:** Stored XSS against students/teachers opening the chapter; token theft.
**Expected Behavior:** Only `http(s)` URLs stored/rendered; iframes sandboxed.
**Recommended Fix:** Validate scheme server-side (`url` + allow `https`), reject in `resolveViewableUrl`, add `sandbox="allow-scripts allow-same-origin"` only for trusted hosts (or none), and require auth on the route.
**Verification:** Upload link `javascript:alert(1)`; it must be rejected.

## LMS-22
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** H5P attempts / scoring
**Location:** `D:\lms_k12\lib\h5p\{true-false,single-choice-set,memory-game,text-activity-scoring,drag-drop-scoring,course-presentation-scoring}.ts`; `app\h5p\data\h5p.ts:522-590` (`postH5pXapiStatement`); `app\h5p\components\content-type-list.tsx:78-100`; `app\h5p\h5p_mcq\page.tsx:50-95,438-600`
**Function/Method:** scorers, `postH5pXapiStatement`, MCQ certificate
**Problem:** All grading is client-side over data that includes the correct answers. The only outbound record is an xAPI statement whose `success`/`response` are asserted by the browser and consumed by PAL BKT mastery/misconception jobs (learner ownership is verified, the outcome is not). Scores, attempts and `passed` are not stored or readable ("xAPI statements are written and never read back"), and the MCQ "Certificate of Achievement" (name from localStorage) is printable with a self-chosen score. Pass rules are inconsistent (`pass_percentage ?? 100` for text-activity/drag-drop, `|| 0` elsewhere; overlapping-band tie rule stated as "last match wins" in each scorer).
**Evidence:** `success: result.passed` (course presentation `:232`), `Nothing is submitted to the server.` (`h5p_mcq/page.tsx:50`), `const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;`.
**Impact:** PAL mastery can be inflated by a crafted xAPI POST; teachers have no H5P gradebook; certificates are forgeable. (Scoring math itself is well guarded against 0/0.)
**Expected Behavior:** Server grades from stored keys (or recomputes) and stores attempts; certificate issued server-side.
**Recommended Fix:** Add an attempts endpoint that re-scores server-side, store per-learner results, gate the certificate, unify pass defaults.
**Verification:** POST an xAPI `success:true` without answering; server must not raise mastery.

## LMS-23
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Result - grade / rank / pass rules
**Location:** `D:\next_lms_erp\app\Helpers\Helper.php:2282-2301` (`getGrade`), `classwiseGradeReportController.php:112-168,323-390`; `D:\lms_k12\app\result\marks-entry\page.tsx:96-116`; `D:\next_lms_erp\app\Http\Controllers\api\lms\LmsResultDashboardApiController.php:52`; `D:\lms_k12\app\exam\online\[paperId]\result\page.tsx:36-39`
**Function/Method:** `getGrade`, `getRank`, classwise `Grand Total/Average`
**Problem:** (1) Percentage is rounded to an integer **before** matching breakoffs (34.5 -> 35 = pass grade) while the failed-subject count uses the raw ratio (`< 35`), so a subject can show a passing grade and count as failed. (2) Pass mark is hard-coded: 33 for section ids 148/149 else 35; the dashboard uses 40 ("at risk"); the online-exam UI bands at 35/50/75; H5P uses per-activity values. (3) AB/N.A./EX are persisted as 0 and included in numerator and denominator, and count as failures. (4) Rank is a dense rank over the float percentage string (1,2,2,3). (5) The "Average" row accumulates `total_points` (it is the sum of maxima). (6) `SUM(rc.points)=0` yields NULL percentage (rank key collision). (7) `getGrade` on non-numeric marks (`'AB'`) would raise a PHP 8 `TypeError`; callers rely on being handed numbers.
**Evidence:** `$per = round((100 * $total_gain_mark) / $total_mark, 0);` vs `COUNT(if(((IFNULL(rm.points,0)/rc.points)*100) < $passing_ratio,1,NULL)) AS failed`; `$studentResults[..]['Average'][$subject] += $tot;`.
**Impact:** Inconsistent pass/fail across screens, students penalised for absence/exemption, mislabelled averages.
**Expected Behavior:** One configurable pass mark per standard/section; exempt statuses excluded from denominators; documented tie rule.
**Recommended Fix:** Centralise grading in one service using the `grade_master_data` boundaries on unrounded percent, honour `is_absent`, replace hard-coded ids with configuration, rename or fix "Average".
**Verification:** Unit tests for 34.5%, AB, EX, denominator 0, ties.

## LMS-24
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Exam - AI question paper generator
**Location:** `D:\lms_k12\app\exam\data\aiPaper.ts:required,selectQuestions,generatePaper,saveAiPaper`; `D:\next_lms_erp\app\Http\Controllers\api\ApiQuestionPaperController.php:205-226`
**Function/Method:** `required`, `generatePaper`, `saveAiPaper`, `store`
**Problem:** (a) `saveAiPaper` posts `ai_generated`, `difficulty_distribution`, `taxonomy_distribution`, `sections_config`, but `store()` persists none of them - sections and distributions are lost (the file header claims the endpoint "accepts" them). (b) `marks` per question is a single `marksPerQuestion` that overrides each question's own `points`; `total_marks = count * marksPerQuestion`, while online-exam scoring and the result dashboard use `SUM(lms_question_master.points)` vs `question_paper.total_marks` - two different maxima. (c) `Math.round(total*pct/100)` per bucket can exceed the total (25/25/25/25 of 10 -> 12) and silently starves later buckets. (d) Client-side generation runs N HTTP calls per DOK/Bloom level and is not reproducible.
**Evidence:** store field list lacks the four fields; `marks: marksPerQuestion` in `generatePaper`; `obtain_marks = SUM(points)` (onlineExamController).
**Impact:** Papers whose printed marks disagree with awarded marks (percentages > 100% or understated), lost blueprint metadata.
**Expected Behavior:** Server persists and recomputes totals from question points.
**Recommended Fix:** Persist metadata columns, compute `total_marks` server-side, largest-remainder rounding.
**Verification:** Create a paper with 3-mark questions and `marksPerQuestion=1`; totals must agree.

## LMS-25
**Severity:** Medium   **Type:** Confirmed
**Category:** Business Logic
**Module:** Exam Evaluation publish
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ExamEvaluationApiController.php:598-727`
**Function/Method:** `publish`, `review`
**Problem:** `obtain_marks => (int) round($obtained)` drops fractional marks (0.5-mark schemes); `total_wrong` counts partial credit as wrong while answer rows say 'partial'; `review(approve)` auto-adopts `COALESCE(ai_marks,0)` for every unmarked question; unapproved sheets are excluded with only a message; `lms_offline_exam_answer` delete is not tenant/exam-id scoped (`question_paper_id`,`student_id`).
**Evidence:** lines 634-640, 663-670, 400-407.
**Impact:** Published marks differ from teacher totals; AI marks silently become official.
**Expected Behavior:** Decimal marks preserved; explicit teacher confirmation for AI-derived marks.
**Recommended Fix:** Decimal column, per-question review requirement, consistent right/partial/wrong counts.
**Verification:** Approve a sheet with 4.5 total; published value must be 4.5.

## LMS-26
**Severity:** Medium   **Type:** Confirmed
**Category:** Authorization
**Module:** Frontend route gating (Result, Exam, Course Master, H5P, Quiz, Subjects, SQAA, Learning Outcome)
**Location:** `D:\lms_k12\app\components\ConditionalApp.tsx:33-46`; `app\lms\_shared\RequireStaff.tsx`; absent in `app\result\**`, `app\exam\**`, `app\course-master\**`, `app\h5p\**`
**Function/Method:** `ConditionalApp`, `RequireStaff`
**Problem:** Authorisation is a client convention: no middleware, authentication only via client state, staff-only pages outside `app/lms` have no gate, and `RequireStaff` reads localStorage (`isStudentSession`). Students reach Result/Exam authoring/Course Master authoring by URL; only the Laravel side could stop them (it does not, LMS-03/04/17).
**Evidence:** 25 pages import `RequireStaff`; `grep -c "isStudent|RequireStaff|isStaff"` returns 0 for `exam-creation`, `exam-master`, `progress-report`, `course-master/[courseId]/chapters`, `quiz/*`.
**Impact:** Broad exposure of admin UIs and API surfaces to lower roles.
**Expected Behavior:** Server-enforced rights with UI as convenience.
**Recommended Fix:** Middleware/route-group role checks plus backend enforcement; drive UI hiding from server-provided permissions.
**Verification:** Student session opens `/result/marks-entry`; must be denied server-side.

## LMS-27
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** Menu -> route mapping (Result)
**Location:** `D:\lms_k12\app\data\routeMapper.ts:41-77` (early `RESULT_ROUTE_NAME_MAP`), lookup at `:798`, unreachable overrides `:1053-1155`, typo key `:151`
**Function/Method:** `mapApiLinkToRoute`
**Problem:** 35 entries return paths that do not exist as Next pages (e.g. `marks_entry.index -> /result/marks_entry`, `exam_master.index -> /result/exam_master`, `grade_master.index`, `cbse_result.index`, `wrt_report.index -> /result/WRT_report`). The correct late overrides (`resultRoutes`, `/exam/marks-entry` special case) are shadowed for these keys because the early lookup returns first. Only path-style links (`result/exam_master`) reach the correct targets. Key `'ai_questionpaper.ind ex'` contains a space and is dead.
**Evidence:** script check of every `RESULT_ROUTE_NAME_MAP` value vs `app/<path>/page.tsx` - 35 missing.
**Impact:** If `tblmenumaster.link` holds route names (as `checkPermission` implies) the Result sidebar entries 404 (NOT VERIFIED which form the DB holds).
**Expected Behavior:** Every mapped target exists.
**Recommended Fix:** Delete the early map or point it at the real pages; add a unit test asserting every mapped path exists.
**Verification:** Test that iterates the map and checks `app/**/page.tsx`.

## LMS-28
**Severity:** Medium   **Type:** Architectural
**Category:** Other
**Module:** Duplicate modules
**Location:** `D:\lms_k12\app\exam\marks-entry\page.tsx` vs `app\result\marks-entry\page.tsx`; `app\exam\exam-master\page.tsx` vs `app\result\master\exam-master\page.tsx`; `app\lms\exam\page.tsx` (`QuestionPaperView`) vs `app\exam\online\[paperId]\page.tsx`; `app\learning-outcome\*` vs Laravel `learning_outcome` Blade module
**Function/Method:** -
**Problem:** Parallel implementations with different behaviour: the legacy `/exam/marks-entry` uses `/api/proxy?path=result/marks_entry` (web route + menu rights, no approval/lock UI, `console.error` logging, token in form body) and is what `marks_entry.index` (path form) maps to; `/exam/exam-master` calls `${hostName}/result/exam_master` directly and `window.location.reload()`s after save. Fixes applied to one do not reach the other (e.g. approval lock, LMS-11).
**Evidence:** `routeMapper.ts:1064-1070`; `exam/marks-entry/page.tsx:194` (`/api/proxy?path=result%2Fmarks_entry`).
**Impact:** Inconsistent authorisation/validation across entry points; maintenance cost.
**Expected Behavior:** One page per capability.
**Recommended Fix:** Retire the `/exam/*` duplicates and remap the menu.
**Verification:** Menu link for marks entry opens the page that shows approval state.

## LMS-29
**Severity:** Medium   **Type:** Missing
**Category:** Frontend
**Module:** Quiz, Subjects, Learning Outcome, LMS Message, dead file
**Location:** `D:\lms_k12\app\quiz\create\page.tsx:95-100`, `app\quiz\take\page.tsx:6-15,55-70`, `app\subjects\_lib\subjects-api.ts:36-43`, `app\learning-outcome\*`, `app\lms\message\page.tsx`, `app\course-master\page.redesign.tmp.tsx`
**Function/Method:** `handlePublish`, `TakeQuizPage`, `subjectProgress`
**Problem:** `handlePublish` sets a 1.5 s timeout then navigates - the quiz is never saved (false success). `/quiz/take` is a hard-coded 5-question quiz with `correctIndex` in the bundle, client scoring, and a timer that stops at 0 without submitting. "My Subjects" shows `coverage_percentage`/`lesson_planning_coverage` (teacher curriculum coverage) as the student's progress ("Avg Progress", "Top Subject"). Learning-outcome pages are a generic read-only table (no forms though the API supports writes). `/lms/message` is an honest placeholder. `page.redesign.tmp.tsx` is an unreferenced 234-line leftover.
**Evidence:** code above; `quiz/page.tsx` itself says the feature is "in progress".
**Impact:** Users believe quizzes are published; misleading progress metrics.
**Expected Behavior:** Persisted quizzes or explicit "not available"; metrics labelled correctly.
**Recommended Fix:** Wire to a real API or mark as roadmap; relabel progress; delete the tmp file.
**Verification:** Publish a quiz then reload; it must exist.

## LMS-30
**Severity:** Medium   **Type:** Confirmed
**Category:** Frontend
**Module:** SQAA
**Location:** `D:\lms_k12\app\sqaa\_lib\api.ts:36-60,150-170`; `D:\lms_k12\app\api\proxy\route.ts:forwardWithBody (await request.text())`
**Function/Method:** `saveSqaaEntry`, `request`, `sqaaFileUrl`
**Problem:** The multipart save (`FormData` with PDF/XLSX/DOC files) goes through `/api/proxy`, which reads the body with `request.text()` and re-sends it as text - binary parts are corrupted (homework's `api.ts:411` documents exactly this and bypasses the proxy). The public file URL is hard-coded to `https://s3-triz.fra1.digitaloceanspaces.com/public/sqaa/...`; objects are uploaded public-read with the client file name.
**Evidence:** `saveSqaaEntry -> request('api/sqaa/entry', ..., { method: 'POST', body: form })` -> `fetch('/api/proxy?...')`.
**Impact:** Uploaded evidence documents arrive damaged; environment coupling; publicly readable QA documents.
**Expected Behavior:** Direct multipart POST (or a streaming proxy), configurable asset base URL, private objects with signed URLs.
**Recommended Fix:** Post to Laravel directly like `homework/api.ts` or stream the body in the proxy; move the host to config.
**Verification:** Upload a PDF and compare checksums.

## LMS-31
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** Result API client / shared session
**Location:** `D:\lms_k12\lib\result\api.ts:64-72,142-160`; `lib\erp-client.ts:78-158`
**Function/Method:** `resultGet`, `resultPost`, `buildSessionContext`
**Problem:** The JWT is appended to every URL as `?token=...` (and again in the body) for all Result calls - it lands in server access logs, proxies and Referer headers. `sub_institute_id`, `user_id`, `syear` are always sent from localStorage though the server ignores them (or, worse, trusts them, Section 4). `buildSessionContext` takes `baseUrl` from localStorage `host_name`.
**Evidence:** `...(session.token ? { token: session.token } : {})` in the query object.
**Impact:** Token leakage via logs; needless client identity claims.
**Expected Behavior:** Bearer header only.
**Recommended Fix:** Remove `token` from URL/body; stop sending identity fields to `api.session` routes.
**Verification:** Network tab shows no `token=`.

## LMS-32
**Severity:** Medium   **Type:** Potential
**Category:** Security
**Module:** Laravel middleware (CSRF, menu permissions)
**Location:** `D:\next_lms_erp\app\Http\Middleware\VerifyCsrfToken.php:$except`; `checkPermission.php:34-40`
**Function/Method:** -
**Problem:** `$except` lists `https://erp.triz.co.in/*`, `https://dev.triz.co.in/*`, `http://127.0.0.1:8000/*`; `fullUrlIs` matches these so CSRF is off for **all** web routes on those hosts (cookie-session users), while other hosts (localhost, tenant custom hosts) get 419 on every H5P/online-exam write (the file's own comment describes this failure for PAL). `check_permissions` resolves rights by `tblmenumaster.link == currentRouteName`; resource sub-routes (`marks_entry.store`, `h5p_*.store`) find no row unless one exists, and the code then skips every check.
**Evidence:** `$menu_id = DB::table('tblmenumaster')->where('status',1)->where('link',$currentRouteName)->value('id'); if($menu_id!=''){...}`.
**Impact:** CSRF exposure on the main hosts; writes possibly unprotected by rights; H5P/exam writes failing on other hosts. Depends on DB rows (NOT VERIFIED).
**Recommended Fix:** Path-based exemptions only for token routes; fail closed when no menu row.
**Verification:** Inspect `tblmenumaster` for `*.store` links; CSRF test on the prod host.

## LMS-33
**Severity:** Low   **Type:** Potential
**Category:** Security
**Module:** Question paper asset proxy
**Location:** `D:\lms_k12\app\api\question-paper\asset\route.ts:56-110`; `lib\question-paper\images.ts:isAllowedAssetUrl`
**Function/Method:** `GET`
**Problem:** Unauthenticated, but allow-listed by origin with `redirect: 'follow'`, so an open redirect on an allowed host (ERP, AI host, `QUESTION_ASSET_ORIGINS`) can steer the fetch to an internal target; the `image/*` content-type and 8 MB checks bound the read. Allow-list depends on live env (NOT VERIFIED).
**Evidence:** `fetch(url, { redirect: 'follow' })` after `isAllowedAssetUrl`.
**Impact:** Limited SSRF-by-redirect; mitigated by content-type check.
**Recommended Fix:** `redirect: 'manual'` and re-validate each hop; require a session.
**Verification:** Unit test with a redirecting fixture.

## LMS-34
**Severity:** Medium   **Type:** Architectural
**Category:** Backend
**Module:** Course Master / content APIs (auth rollout)
**Location:** `D:\lms_k12\app\course-master\data\chapters.ts:754,818-830,862,1186-1330` and `lmsCourses.ts:87`; `D:\next_lms_erp\app\Http\Middleware\LmsApiAuth.php`, `RequirePermission.php`; `config\lms_content.php:144`
**Function/Method:** `uploadChapterContent`, `fetchChapterContent`, `fetchLmsCourses`
**Problem:** `lms.auth`/`perm:` run in warn-only mode because the frontend still calls content endpoints with a bare `fetch()` and **no Authorization header** (upload, question bank, courses). Turning enforcement on would break upload/authoring; leaving it off keeps LMS-04/21 exploitable. Stale `TODO(backend)` comment and `PERSIST_ENABLED = true` flag remain in `chapters.ts`.
**Evidence:** `fetch(\`${API_BASE_URL}${CHAPTER_CONTENT_STORE_ENDPOINT}\`, { method: 'POST', body: form })` (no headers).
**Impact:** Security posture blocked on a coordinated frontend rollout.
**Expected Behavior:** All calls carry the bearer token; enforcement on.
**Recommended Fix:** Add `createAuthHeaders` to every course-master call, then set `LMS_API_AUTH_ENFORCE=true`.
**Verification:** Zero "unauthenticated content API request" log lines, then flip.

## LMS-35
**Severity:** Low   **Type:** Improvement
**Category:** Frontend
**Module:** Session/year handling
**Location:** `D:\lms_k12\app\course-master\page.tsx:132-151` (`getSyear`), `lib\erp-client.ts:100-127`, `lib\result\api.ts:52-59`; `app\h5p\data\h5p.ts:5`, `app\subjects\_lib\subjects-api.ts:4`, `app\chapters\_lib\chapters-api.ts:8` (import from `@/app/course-master/page`)
**Function/Method:** `getSyear`, `getResultSession`, `buildSessionContext`
**Problem:** Three academic-year resolvers disagree (active term vs `academicYears[0]` "earliest year" vs `selectedAcademicYear`); H5P/subjects/chapters import helpers from a **page module** (pulls the 959-line page and its dependencies into other bundles and couples layers).
**Evidence:** `erp-client.ts` comment: "`academicYears[0]` is merely the earliest year on file ... must not be the primary fallback" while `getSyear()` uses exactly that.
**Impact:** Wrong-year data in course/H5P screens.
**Recommended Fix:** Single `getSession()` util in `lib/`, import from there.
**Verification:** Same year across modules for a multi-year tenant.

## LMS-36
**Severity:** Low   **Type:** Confirmed
**Category:** Security
**Module:** Error/debug output
**Location:** `D:\next_lms_erp\app\Http\Controllers\api\ApiLmsCourseController.php:persistContent (catch)` (`'debug_data' => $content`, `'Database error: ' . $e->getMessage()`); `H5PScenarioController.php:getH5pAIScenario` (returns `raw_output`, exception messages); frontend `course-master\lesson-plan\[courseId]\page.tsx:955-1341`, `sideDrawer.tsx:735-737` (console logs of profile data and AI prompts)
**Problem:** Internals (SQL errors, request payload) returned to clients; PII/prompt logging in the browser console.
**Impact:** Information disclosure aiding LMS-01.
**Recommended Fix:** Generic messages + server log; remove console logging.
**Verification:** Force a DB error; response must not echo it.

## LMS-37
**Severity:** Medium   **Type:** Confirmed
**Category:** Security
**Module:** H5P AI scenario
**Location:** `D:\next_lms_erp\app\Http\Controllers\lms\h5p\H5PScenarioController.php:366-415`; `routes\lms.php:551-552`
**Function/Method:** `getH5pAIScenario`
**Problem:** Public route (no middleware), calls `https://openrouter.ai/...` with `'verify' => false` (TLS verification disabled) and `env('OPENROUTER_API_KEY')` (returns null once config is cached), interpolates unvalidated prompt/title/standard fields, no rate limit, no size cap on `image`.
**Evidence:** `$client->post('https://openrouter.ai/api/v1/chat/completions', ['verify' => false, 'headers' => ['Authorization' => 'Bearer ' . env('OPENROUTER_API_KEY')] ...`.
**Impact:** Anonymous LLM cost abuse; API key exposed to MITM; feature silently breaks under `config:cache`.
**Recommended Fix:** Auth + throttle, `verify=true`, move key to `config()`.
**Verification:** Unauthenticated POST returns 401.

## LMS-38
**Severity:** Medium   **Type:** Missing
**Category:** Testing
**Module:** All
**Location:** `D:\lms_k12\lib\h5p\*.test.ts`, `lib\question-paper\*.test.ts` (20 files); `D:\next_lms_erp\tests\**`
**Problem:** Only pure `lib` helpers have tests. No tests for marks/grade/rank, online-exam scoring, result authorisation, tenant isolation, route mapper, proxies, homework/evaluation workflows, or SQAA. Every Critical/High item above would be caught by a small feature test.
**Impact:** Regressions ship unnoticed; security fixes unprovable.
**Recommended Fix:** Add Laravel feature tests (401/403/tenant-isolation per route group, exam scoring, marks rules) and frontend unit tests for `calculatePercentage/findGrade`, `mapApiLinkToRoute`, `listOnlineExams`.
**Verification:** CI runs them.

## LMS-39
**Severity:** Info   **Type:** Improvement
**Category:** Frontend
**Module:** Design-system drift
**Location:** `D:\lms_k12\app\h5p\h5p_mcq\page.tsx:66-69` (gradients), `app\subjects\page.tsx:7` (emoji), `app\quiz\take\page.tsx` (rounded-[2rem], shadows)
**Problem:** Contradicts `CLAUDE.md` design rules (flat surfaces, no gradients, no emoji).
**Impact:** Visual inconsistency only.
**Recommended Fix:** Replace with design-system components.
**Verification:** Visual review.

---

ISSUE COUNTS: C=6 H=15 M=14 L=3 I=1
