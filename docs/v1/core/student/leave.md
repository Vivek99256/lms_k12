# Leave (Student)
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/leave` → redirects to `/front_desk/leave_application` | **v1 status:** Redirect only

| Field | Value |
|---|---|
| Backend routes | Handled by front_desk leave controllers |
| Roles | Admin, Class Teacher, Parent, Student |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Student leave application and approval. The `/students/leave` route is a redirect — it immediately forwards to `/front_desk/leave_application`, where the actual functionality lives.

This entry point exists in the Students module menu so users can access leave from the student context, but the feature is owned by the Front Desk / Timetable module.

## 2. Screens
No screen renders at `/students/leave`. It is a Next.js `redirect()` to `/front_desk/leave_application`.

The actual screens are documented under `docs/v1/core/timetable/leave-application.md`.

## 3. Features & business rules
See `/front_desk/leave_application`. Summary:
- Parents/students submit leave applications with reason, dates, and supporting documents.
- Class teachers and admin approve or reject.
- Approved leaves are reflected in attendance records.

## 4. User flows
1. Navigate to Students → Leave.
2. Immediately redirected to `/front_desk/leave_application`.
3. See Front Desk → Leave Application for all flows.

## 5. Data model
Owned by front_desk module. TBD — see timetable documentation.

## 6. APIs
Owned by front_desk module. TBD.

## 7. UI components & design tokens
N/A — this route renders no UI.

## 8. Reports & exports
N/A.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-LV-01 | Navigate to /students/leave | Click leave menu item | Redirected to /front_desk/leave_application | Happy |

## 10. Known issues, limitations & FAQs
- The menu item under Students → Leave navigates to `/front_desk/leave_application`. This is a cross-module dependency; if the front_desk route changes, this redirect breaks.

## 11. Sales notes
Leave application and approval is a standard ERP feature. Detailed selling points are in the Front Desk module documentation.

## 12. v1 status & v2 ideas
**v1:** Redirect shim only.
**v2 ideas:** Native leave management within the student module with its own screens; student self-service leave history view.

## Source files
- `C:\rajesh\lms_k12\app\students\leave\page.tsx` (redirect only)
- See `C:\rajesh\lms_k12\app\front_desk\leave_application\` for the actual implementation
