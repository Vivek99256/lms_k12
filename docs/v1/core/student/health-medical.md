# Health & Medical
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/health_medical` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `POST /api/proxy?path=get_adminStudentSearch` · `GET /api/proxy?path=student-infirmary` · `GET /api/proxy?path=student-care/vaccination` |
| Roles | Admin, Medical Staff, Principal |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Provides a consolidated health view across all students — vaccination compliance, infirmary visit counts, flagged medical conditions, and allergies. Medical staff and admin use this for health compliance audits and emergency-contact readiness.

## 2. Screens

**Health & Medical** (`/students/health_medical`)
- Metric cards: Total profiles, Vaccination compliance (%), Conditions flagged, Infirmary visits
- Condition chart (`ConditionChart`)
- Compliance chart (`ComplianceChart`)
- Chart panel (`ChartPanel`)
- Flagged students table: Initials, Name, Grade, Section, Blood Group, Condition, Allergies, Vaccination status, Infirmary visits

Separate legacy screens:
- `/student/student_health` — legacy health entry
- `/student/student_infirmary` — infirmary visit entry
- `/student/student_vaccination` — vaccination entry

![](./screenshots/health-medical.png)

## 3. Features & business rules

### Flagged student criteria (client-side)
A student is shown in the flagged table if any of:
- `condition !== '—'` (has an infirmary disease/complaint recorded)
- `allergies !== 'None'` (note: in v1 allergies is always "None" — no allergies API endpoint found)
- `vaccination === 'Overdue'` (not in vaccinated set)

### Vaccination status
- "Up to date" if `student_id` appears in any `student_vaccination` record for the period.
- "Overdue" otherwise.

### Infirmary visit count
- Count of `student_infirmary` rows for that `student_id`.
- Primary condition shown = `disease` or `complaint` from the most recent infirmary row.

### Metrics
- Total profiles: total students in roster
- Vaccination compliance: `(vaccinated_count / total) × 100`
- Conditions flagged: students with a non-empty condition
- Infirmary visits: total `student_infirmary` records

## 4. User flows

**View health overview**
1. Navigate to Students → Health & Medical.
2. Three parallel API calls: student roster, infirmary records, vaccination records.
3. Data joined client-side by `student_id`.
4. Metrics and table render.

**Record entry** (legacy screens)
- Infirmary visit: `/student/student_infirmary`
- Vaccination: `/student/student_vaccination`
- General health: `/student/student_health`

## 5. Data model

### `student_health`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| student_id | bigint FK | |
| syear | decimal(4,0) | |
| marking_period_id | bigint | |
| doctor_name | varchar(100) | |
| doctor_contact | varchar(11) | |
| date | date | |
| file | mediumtext | Attached document |
| sub_institute_id | bigint FK | |

### `student_vaccination`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| student_id | int | |
| syear | decimal(4,0) | |
| doctor_name, doctor_contact | varchar | |
| vaccination_type | varchar(50) | |
| note | varchar(100) | |
| date | date | |
| created_by, sub_institute_id | int | |

### `student_infirmary`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| student_id | int | |
| syear | decimal(4,0) | |
| doctor_name, doctor_contact | varchar | |
| medical_case_no | varchar(50) | |
| date | date | |
| complaint, symptoms, disease, treatments | varchar | |
| medical_close_date | date | |
| health_center | varchar(50) | |
| created_by, sub_institute_id | int | |

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `get_adminStudentSearch` | Session | Session params | Student roster | — |
| GET | `student-infirmary` | Session | Session params | `{ status:1, data: { records:[...] } }` | — |
| GET | `student-care/vaccination` | Session | Session params | `{ status:1, data:[...] }` | — |

## 7. UI components & design tokens
- `ChartPanel`, `ConditionChart`, `ComplianceChart` — health data charts
- `MetricCard` — KPI tiles (Heart, Syringe, AlertTriangle, Activity icons)
- `StudentHealthTable` — flagged students table with vaccination badge
- Vaccination badge: "Up to date" = green, "Overdue" = red/amber

## 8. Reports & exports
See [../student/reports.md](reports.md) — Health Report.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-HLTH-01 | View health metrics | Navigate to health_medical | Metrics load; table shows flagged students | Happy |
| S-HLTH-02 | Student with infirmary visit | Student has infirmary record | Condition shown; visit count > 0 | Happy |
| S-HLTH-03 | Vaccination compliance | 50% vaccinated | Compliance = 50% | Happy |
| S-HLTH-04 | No health records | No infirmary/vaccination records | All students show Overdue; conditions = "—" | Edge |
| S-HLTH-05 | API partial failure | Infirmary API returns non-1 status | Infirmary records treated as empty; no crash | Edge |

## 10. Known issues, limitations & FAQs
- Allergies are always shown as "None" in v1 — no API endpoint returning allergy data was found in the health_medical API module.
- The modern dashboard (`/students/health_medical`) is read-only; all data entry is via legacy screens.
- `student_height_weight` table exists in migrations but no frontend screen was found that uses it.

**FAQ:** *Where do I record a vaccination?* — Use `/student/student_vaccination` (legacy screen).

## 11. Sales notes
**Selling points:** Single-screen health compliance view across all students; instant vaccination compliance percentage; infirmary visit tracking.

**Demo flow:**
1. Show vaccination compliance metric.
2. Show flagged students table with conditions and visit counts.
3. Navigate to legacy infirmary entry.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** Metrics, flagged table, infirmary + vaccination data join.
**Partial:** Allergies (table shows "None" always); height/weight data not surfaced.
**v2 ideas:** Allergies API; height/weight chart; parent-visible health summary; automated vaccination reminder.

## Source files
- `C:\rajesh\lms_k12\app\students\health_medical\page.tsx`
- `C:\rajesh\lms_k12\app\students\health_medical\api.ts`
- `C:\rajesh\lms_k12\app\students\health_medical\components\`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_student_health_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_student_vaccination_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_student_infirmary_table.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentHealthController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentVaccinationController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentInfirmaryController.php`
