# Menu Data-Source Audit

**Repository:** lms_k12 (Teach Connect LMS)
**Date:** 2026-08-22
**Scope:** All 54 top-level menus (app modules) under `app/`

---

## Summary

**14 of the 54 top-level menus contain static/hardcoded data.** The remaining 40 are fully API-driven (39 verified live API + 1 empty placeholder, `admission-Enquiry`).

> The sidebar menu **structure itself** is fully dynamic — `app/data/menuItems.ts` is an empty array populated from the menu API at runtime (see `app/data/menuMappers.ts`). This audit covers the **data rendered by each menu's screens**, not the navigation tree.

| Verdict | Menus | Share |
|---|---|---|
| API-driven (live backend) | 39 | 72% |
| Fully static / hardcoded | 5 | 9% |
| Mixed (API + some hardcoded screens) | 8 | 15% |
| Static data present only as dead code | 1 | 2% |
| Empty placeholder | 1 | 2% |
| **Total** | **54** | 100% |

---

## Method

1. Scanned all ~700 `.ts` / `.tsx` files across the 54 menu directories under `app/`.
2. Built a whole-repo import graph to detect API usage:
   - Direct network calls: `fetch(`, `axios`, `API_BASE_URL`, `buildSessionContext`, `erpGet/erpPost`, `apiClient`, `useSWR`, `XMLHttpRequest`.
   - Propagated through **relative and `@/` alias imports** into shared data layers (e.g. `lib/result/api`, `app/fees/_lib/fees-api`, `lib/erp-client`).
3. Flagged hardcoded record arrays (inline `const rows = [ {...}, {...} ]`, `useState([ {...} ])`) and explicit `mock data` / `hardcoded` / `demo data` comments.
4. Manually verified every flagged file to exclude:
   - UI configuration (nav links, tab lists, table column definitions, dropdown option lists, form field configs).
   - Arrays derived from API-fetched props/state.
   - Historical/negative comments (e.g. *"never hardcoded"*, *"replaces the hardcoded list the legacy screen shipped with"*).

---

## Findings

### A. Fully static menus — 5 (no API integration at all)

| Menu | Hardcoded content | Key file(s) |
|---|---|---|
| `ai-platforms` | Entire AI-tools directory (names, descriptions, categories, logos) inline in the page | `app/ai-platforms/page.tsx` |
| `attendance` | Attendance dashboard renders a hardcoded student register (`STU001 Kiara Kapoor`, …) | `app/attendance/attendance_dashboard/page.tsx` |
| `chapters` | Hardcoded chapter / lesson / simulator / PDF content | `app/chapters/page.tsx` |
| `quiz` | Hardcoded subjects, chapters and a sample quiz question | `app/quiz/create/page.tsx` |
| `subjects` | Hardcoded subject list and subject categories (name, emoji, progress) | `app/subjects/page.tsx`, `app/subjects/categories/page.tsx` |

### B. Mixed menus — 8 (API-driven, but specific screens render hardcoded data)

| Menu | Hardcoded content | Key file(s) |
|---|---|---|
| `students` | 5 mock screens (explicit "mock data" comments): health & medical register, discipline incidents, house points, document verification, ID-card preview | `app/students/health_medical/page.tsx`, `app/students/discipline/page.tsx`, `app/students/house/page.tsx`, `app/students/student_documents/page.tsx`, `app/students/ICards/page.tsx` |
| `hrit` | Hardcoded employee attendance records (`EMP001 Amit Sharma`, …) and leave-report catalog, both consumed by live report pages | `app/hrit/attendance-management/attendance-reports/services/report-data.ts`, `app/hrit/leave-management/leave-reports/services/leave-reports-data.ts` |
| `course-master` | Hardcoded course catalog (`courses` array: 20 courses with codes, instructors, enrollments) imported by live course/lesson-plan pages | `app/course-master/data/courses.ts` |
| `admissions` | Hardcoded admission-form templates and hardcoded follow-up communication logs | `app/admissions/admission_form/page.tsx`, `app/admissions/admission_followUp/page.tsx` |
| `lms` | Reports page (hardcoded completion metrics/charts) and exam page (`studentChapterProgressData`), despite API usage elsewhere in the module | `app/lms/reports/page.tsx`, `app/lms/exam/page.tsx` |
| `Institute_Detail` | Department SOP screen renders a hardcoded activity feed | `app/Institute_Detail/Department/Component/sops.tsx` |
| `organization-management` | Compliance library uses hardcoded department → employee mappings | `app/organization-management/compliance-library/components/compliance-library-management-shared.tsx` |
| `talent-management` | Mock talent profiles (live in the recruitment profile panel); `mockAdminKPIs` still back the 5 KPI cards of the Administration center (no `/talent/admin/kpis` endpoint exists) | `app/talent-management/_components/talent-profile-data.ts`, `app/talent-management/administration/components/admin-data.ts` |

### C. Static data present only as dead code — 1

| Menu | Note |
|---|---|
| `pal` | `app/pal/content-model-data.ts` is a static catalog with **no importers** (orphaned). All live PAL pages (`pal/report`, `pal/result`, `pal/new/*`) fetch from the API. Two additional `talent-management` files (`mobility-data.ts`, `offboarding-data.ts`) are also documented dead code, ported verbatim from G2G for parity and not wired into any page. |

### D. Verified API-driven menus — 39

`Institute_Detail`*, `Inventory`, `Transportation`, `Utility`, `academic_setup`, `admin-services`, `bazar`, `career-counselling`, `classteacher`, `classteacherReport`, `dashboard`, `document-templates`, `easy_com`, `exam`, `fees`, `front_desk`, `general`, `h5p`, `hostel`, `import-data`, `inward_outward`, `learning-outcome`, `library`, `login`, `migration-modules`, `proxy_master`, `proxy_report`, `reports`, `result`, `settings`, `sqaa`, `sqaa_document_report`, `sqaa_master`, `student`, `task-management`, `teacher_daily_report`, `teachertransfer`, `todays_proxy_report`, `user`, `user_log`

\* `Institute_Detail` is API-driven overall but counted in group B due to the hardcoded SOP activity feed. The same applies to the other group-B menus, whose remaining screens are API-driven.

### E. Empty placeholder — 1

`admission-Enquiry` — a single placeholder page with no data source.

---

## Notes & caveats

- The codebase is self-documenting about mock data — many files carry header comments such as *"Mock data extracted directly from the design system specifications"* (`app/students/health_medical/page.tsx`), so `grep -rn "mock data\|hardcoded" app/` recovers most of the list.
- `app/lms/message/page.tsx` is an intentional "Not yet available" placeholder: the legacy Laravel source has no controller logic or data model, so there is nothing to integrate. Not counted as static data.
- Some "hardcoded" mentions are negative assertions of good practice (e.g. `app/fees/_components/fees-charts.tsx`: *"they come from the response, never hardcoded"*; `app/hrit/_lib/use-salary-certificate.ts` documents a hardcoded list that was **replaced** by an API). These were excluded.
- A file is counted as "static" only when the hardcoded data is actually rendered or consumed by a live page; orphaned mock files are listed separately in group C.

## Recommended follow-ups

1. **Prioritise group A** (`attendance`, `subjects`, `chapters`, `quiz`, `ai-platforms`) for API integration — these menus show entirely fabricated data to users.
2. **Replace the `students` mock screens** (health, discipline, house, documents, ID cards) — they display realistic-looking personal/medical data that could be mistaken for real records.
3. **Wire `hrit` attendance/leave reports** to the backend, or clearly mark them as demo data in the UI.
4. **Delete or relocate dead mock files** (`pal/content-model-data.ts`, `talent-management` `mobility-data.ts` / `offboarding-data.ts`) to avoid confusion.
5. **Move `course-master/data/courses.ts`** behind the course API, since live pages currently mix it with fetched data.

---

*Audit produced by an automated source scan (import-graph API detection + hardcoded-array detection) with manual verification of every flagged file.*
