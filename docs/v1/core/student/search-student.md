# Search Student
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/search_student` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/proxy?path=get_adminStudentSearch` · `PUT /api/proxy?path=get_adminStudentSearch/{id}` · `POST /api/proxy?path=get_adminAcademicSection` · `POST /api/proxy?path=get_adminStandard` · `POST /api/proxy?path=get_adminDivision` |
| Roles | Admin, Class Teacher, Coordinator, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Central directory of all students. Staff search and filter by section/standard/division, name, GR number, status, house, or class. Results are paginated. Each student row opens a detail drawer with full profile; staff can edit basic fields inline. Used daily by admin, class teachers, and coordinators.

## 2. Screens

**Student Directory** (`/students/search_student`)
- KPI cards: active students, classes, left this year, retention rate
- Filter bar: Section / Standard / Division cascades + name / GR text search + status and house quick-filters
- Sortable, paginated table (10/25/50 per page)
- Multi-select checkboxes for bulk operations
- Student Detail Drawer: full profile view with inline edit

![](./screenshots/search-student.png)
![](./screenshots/search-student-drawer.png)

## 3. Features & business rules

### Search filters
| Filter | Type | Notes |
|---|---|---|
| Section (grade) | Select | Loaded from `get_adminAcademicSection` |
| Standard | Select | Cascades from Section |
| Division | Select | Cascades from Standard |
| First Name | Text | Partial match |
| Last Name | Text | Partial match |
| GR No. | Text | Exact/partial match |
| Status | Select | All / Active / Inactive / Transferred / Alumni |
| House | Select | All / Red / Blue / Green / Yellow (UI hard-coded defaults) |
| Class (quick filter) | Select | 9 / 10 / 11 / 12 (UI hard-coded defaults) |

### Student status normalization (client-side)
| Raw value | Displayed as |
|---|---|
| `status=0` or `inactive` or `end_date` present | Inactive |
| `transferred` | Transferred |
| `alumni` | Alumni |
| anything else | Active |

### Inline edit (via drawer)
Fields editable: name, admission_no, roll_no, class_name, section_name, house, gender, dob, father_name, mother_name, mobile, email, address, blood_group.

### Sorting
Client-side sort on: name, admissionNo, class, section, rollNo, gender, status.

### Pagination
Client-side: 10 / 25 / 50 rows per page. All matching students are fetched in one API call (no server-side pagination on this endpoint).

## 4. User flows

**Search happy path**
1. Navigate to Student → Search Student.
2. Select Section → Standard → Division (optional) or type a name / GR No.
3. Click Search. Table populates.
4. Click a row to open the Student Detail Drawer.
5. Edit fields in drawer, click Save.

**Quick text search**
1. Type in the name or GR No. text box.
2. Table filters client-side in real time against the loaded result set.

## 5. Data model
Data comes from `tblstudent` joined with `tblstudent_enrollment` (via backend `get_adminStudentSearch`). Key fields returned:

| Field | Source |
|---|---|
| student_id / id | tblstudent.id |
| enrollment_no / admission_no | tblstudent.enrollment_no |
| first_name, middle_name, last_name | tblstudent |
| standard, division | tblstudent_enrollment → school_setup |
| roll_no | tblstudent |
| gender | tblstudent |
| dob / birth_date | tblstudent |
| mobile | tblstudent |
| email | tblstudent |
| house | tblstudent |
| bloodgroup | tblstudent |
| status | tblstudent.status + end_date logic |
| attendance_percentage | computed |

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `get_adminStudentSearch` | Session token | Form: grade, standard, division, first_name, last_name, gr_no, including_inactive | `{ status:1, data: [Student[]] }` | 400 invalid session |
| PUT | `get_adminStudentSearch/{id}` | Session token | URL-encoded student fields | `{ status:1 }` | 404 not found, 422 validation |
| POST | `get_adminAcademicSection` | Session token | sub_institute_id, token | `{ data: [{id, title}] }` | — |
| POST | `get_adminStandard` | Session token | grade_id | `{ data: [{id, name}] }` | — |
| POST | `get_adminDivision` | Session token | standard_id, syear | `{ data: [{id, name}] }` | — |

## 7. UI components & design tokens
- `StudentProfilesDashboard` — KPI card row
- `StudentProfilesTab` — paginated table with multi-select
- `StudentDetailDrawer` — slide-over drawer with inline edit form
- `MetricCard` — KPI tile (active students, classes, left, retention)
- `StatusBadge` — coloured pill for Active / Inactive / Transferred / Alumni
- `TableHeader` — sortable column header
- Recharts `BarChart` for attendance trend and subject performance (chart data is static in v1)
- Lucide icons: `Plus`, `X`, `Calendar`, `Users`, `UserCog`, `Building2`, `Phone`, `Mail`, `Home`, `Search`

## 8. Reports & exports
Export functionality: TBD (not found in this page's source; may be in `/student/report/*`).
See [../student/reports.md](reports.md) for the full Student Reports catalog.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-SRCH-01 | Search by Division | Select Section/Standard/Division, click Search | Table shows only students in that division | Happy |
| S-SRCH-02 | Search by GR No. | Type GR number, click Search | Matching student returned | Happy |
| S-SRCH-03 | Search with no filters | Submit with all filters blank, including_inactive=Yes | All students returned | Happy |
| S-SRCH-04 | Inactive students visibility | Set including_inactive=Yes | Inactive students shown with badge | Edge |
| S-SRCH-05 | Edit student name in drawer | Open drawer, change name, save | PUT sent; updated name reflects | Happy |
| S-SRCH-06 | Sort by class | Click class column header | Rows re-sort A→Z | Happy |
| S-SRCH-07 | Pagination to page 2 | Load 25+ students, click page 2 | Correct slice shown | Edge |
| S-SRCH-08 | No results | Search with non-existent GR | "No students found" state | Negative |

## 10. Known issues, limitations & FAQs
- Attendance trend and subject performance charts on this page use static/hardcoded data (`attendanceTrend`, `subjectPerformance` arrays in page.tsx). They do not reflect real student data in v1.
- House filter options (Red/Blue/Green/Yellow) and class quick-filter (9/10/11/12) are hardcoded in the frontend; they do not match the actual houses/classes configured in the backend.
- All students are fetched in one API call — there is no server-side pagination. This may be slow for schools with 2,000+ students.

**FAQ:** *Can a teacher see all students?* — Only those in their assigned class/division via RBAC; full list requires Admin role.

## 11. Sales notes
**Selling points:**
- Single-screen directory with inline edit — no navigating away to update a record.
- Real-time client-side text search and status/house filters after the initial load.
- Multi-select for future bulk actions.

**Demo flow:**
1. Show cascading filter and instant search results.
2. Click a student row — show the full detail drawer.
3. Edit a field inline and save.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** Search, filters, detail drawer, inline edit, pagination, sorting.
**Partial:** Charts show static data; house/class filter options are hardcoded.
**v2 ideas:** Server-side pagination for large schools; real attendance/performance data in charts; bulk export; photo display in drawer.

## Source files
- `C:\rajesh\lms_k12\app\students\search_student\page.tsx`
- `C:\rajesh\lms_k12\app\students\search_student\api.ts`
- `C:\rajesh\lms_k12\app\students\search_student\components\StudentDetailDrawer.tsx`
- `C:\rajesh\lms_k12\app\students\search_student\components\StudentProfilesDashboard.tsx`
- `C:\rajesh\lms_k12\app\students\search_student\components\StudentProfilesTab.tsx`
- `C:\rajesh\lms_k12\app\students\search_student\components\StatusBadge.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentSearchController.php`
