# ID Cards
**Product:** Scholar Core | **Module:** Student | **Frontend route:** `/students/ICards` | **v1 status:** Partial

| Field | Value |
|---|---|
| Backend routes | `POST /api/proxy?path=get_adminStudentSearch` (fetches one student for preview) |
| Roles | Admin, Coordinator |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Landing page for ID card generation. Shows a preview of a student identity card and provides action buttons for generating student cards, staff/teacher cards, and bulk printing. Used by admin around the start of an academic year or when new students join.

## 2. Screens

**ID Cards Hub** (`/students/ICards`)
- Preview pane showing a sample Student Identity Card with school name, student name, admission number, class, house, blood group, emergency contact, and validity.
- Three action buttons: Generate Student Cards, Generate Staff Cards, Bulk Print.
- Loading and error states.

Additional related routes:
- `/student/student_icard` — Generate student ID cards (class-wise)
- `/student/teacher_icard` — Generate teacher ID cards
- `/student/user_icard` — Generate user/staff ID cards
- `/student/my_icard` — Student self-service: view own ID card

![](./screenshots/id-cards-hub.png)

## 3. Features & business rules

### Preview card fields
| Field | Source |
|---|---|
| School name | `localStorage.userData.school_name` |
| Card title | "STUDENT IDENTITY CARD" (hardcoded) |
| Student name | first_name + middle_name + last_name from tblstudent |
| Admission no. | enrollment_no |
| Grade/Class | standard + division |
| House | tblstudent.house |
| Blood group | tblstudent.bloodgroup |
| Emergency contact | tblstudent.mobile |
| Valid till | 31 Mar {syear + 1} |
| Initials (avatar) | First letter of each name word (max 2 chars) |

### Card generation
The hub page delegates to child routes for actual generation (`/student/student_icard` etc.). The hub itself only shows the preview and links.

## 4. User flows

**View card preview**
1. Navigate to Students → ID Cards.
2. Page fetches the first student from the current session's class.
3. Preview card renders with that student's data.

**Generate student cards**
1. Click "Generate Student Cards".
2. Navigates to `/student/student_icard` for class-wise bulk card generation.

**Generate staff cards**
1. Click "Generate Staff Cards".
2. Navigates to `/student/teacher_icard`.

## 5. Data model
Preview reads from `tblstudent` via `get_adminStudentSearch` (see Search Student). No dedicated table for ID card generation state.

## 6. APIs
| Method | Endpoint | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `get_adminStudentSearch` | Session token | Session params (fetches first student) | `{ status:1, data:[...] }` | 400 session error |

## 7. UI components & design tokens
- `IdCardsContent` component (`app/students/ICards/page.tsx`)
- `StudentPreview` type for card data
- `getStudentIdCardPreview` API helper
- Lucide icons: `CreditCard`, `UserCheck`, `Layers`, `QrCode`, `Printer`, `Camera`, `Settings`
- School name read from `localStorage.userData` with fallback to "Teach Connect"

## 8. Reports & exports
No report on this screen. Card printing is handled by the generation sub-routes.

## 9. Test cases
| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| S-ICARD-01 | Preview loads | Navigate to /students/ICards | Preview card renders with student data | Happy |
| S-ICARD-02 | No students | Session with no enrolled students | Card shows empty/placeholder data | Edge |
| S-ICARD-03 | School name fallback | localStorage.userData missing | School name shows "Teach Connect" | Edge |
| S-ICARD-04 | Valid till calculation | Academic year 2026 | "Valid till: 31 Mar 2027" | Happy |

## 10. Known issues, limitations & FAQs
- The preview fetches the first student from `get_adminStudentSearch` — not necessarily a representative student.
- QR code icon is shown in the UI but QR generation functionality is TBD (no QR API call found).
- School name is read from `localStorage`, which will be empty on first load in an SSR/no-JS context.

## 11. Sales notes
**Selling points:** One-click bulk ID card generation for all students; teacher and user cards from the same module.

**Demo flow:**
1. Navigate to ID Cards; show the live preview card rendering.
2. Click Generate to show the class-wise print flow.

Plan/pricing: TBD

## 12. v1 status & v2 ideas
**Complete:** Preview card, hub navigation to sub-routes.
**Partial:** QR code on card (icon shown, no generation); camera capture button (icon shown, links to face attendance).
**v2 ideas:** QR code on card linking to student profile; bulk download as ZIP of PDFs; custom card templates.

## Source files
- `C:\rajesh\lms_k12\app\students\ICards\page.tsx`
- `C:\rajesh\lms_k12\app\students\ICards\api.ts`
- `C:\rajesh\lms_k12\app\student\student_icard\page.tsx`
- `C:\rajesh\lms_k12\app\student\teacher_icard\page.tsx`
- `C:\rajesh\lms_k12\app\student\my_icard\page.tsx`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\student\studentIcardController.php`
