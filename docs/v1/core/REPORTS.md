# Scholar Core — Reports Catalog

Last updated: 2026-11-03
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> This file catalogs every report in Scholar Core. Each row links to a detailed report doc once written.
> Columns: Report Name | Module/Menu | Frontend Route | Roles | Key Filters | Export Formats | Data Source (tables)

---

## Admissions Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Enquiry Report | Admissions → Reports | `/admissions/admission_reports/enquiry` | Admin, Admissions Staff | Date range, Source, Status | Excel, PDF | `tbl_admission_enquiry` |
| Registration Report | Admissions → Reports | `/admissions/admission_reports/registration` | Admin, Admissions Staff | Academic year, Standard, Status | Excel, PDF | `tbl_admission_registration` |
| Confirmation Report | Admissions → Reports | `/admissions/admission_reports/confirmation` | Admin, Admissions Staff | Academic year, Standard | Excel, PDF | `tbl_admission_form` |
| Follow-up Report | Admissions → Reports | `/admissions/admission_reports/followup` | Admin, Admissions Staff | Date range, Counsellor | Excel | `tbl_follow_up` |
| Conversion Funnel | Admissions → Reports | TBD | Admin | Academic year, Source | TBD | TBD |

---

## Student Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Student List | Student → Reports | `/student/report/student_list` | Admin, Class Teacher | Standard, Division, Academic year | Excel, PDF | `tblstudent` |
| Student Documents | Student → Reports | `/student/report/documents` | Admin | Standard, Division | Excel | `tblstudent_doc_std_mapping` |
| Health Report | Student → Reports | `/student/report/health` | Admin, Medical Staff | Date range, Standard | Excel | `student_health`, `student_vaccination` |
| Discipline Report | Student → Reports | `/student/report/discipline` | Admin, Coordinator | Date range, Standard, Type | Excel | `tbldicipline` |
| Bulk Update Log | Student | `/student/bulk_student_update` | Admin | Date range | Excel | `tblstudent` |
| Class Teacher Report | Academic Setup | `/classteacherReport` | Admin, Principal | Academic year, Standard | Excel | `tblclass_teacher` |

---

## Attendance Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Day-wise Attendance | Attendance | `/student/daywise_student_attendance` | Admin, Class Teacher | Date, Standard, Division | Excel, PDF | `student_attendance` |
| Month-wise Attendance | Attendance | `/student/monthwise_student_attendance` | Admin, Class Teacher | Month, Standard, Division | Excel, PDF | `student_attendance` |
| Yearly Attendance | Attendance | `/student/yearly_student_attendance` | Admin, Principal | Academic year, Standard | Excel, PDF | `student_attendance` |
| Attendance Dashboard | Attendance | `/attendance/attendance_dashboard` | Admin, Principal | Date, Standard | On-screen | `student_attendance` |

---

## Fees Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Fee Collection Report | Fees → Reports | `/fees/reports/collection` | Admin, Accountant | Date range, Standard, Mode | Excel, PDF | `tblfeescollect` |
| Fee Defaulters | Fees → Reports | `/fees/reports/defaulters` | Admin, Accountant | Academic year, Standard, Installment | Excel, PDF | `tblfeescollect`, `tblfeestitle` |
| Fee Cancellation Report | Fees → Reports | `/fees/reports/cancellation` | Admin, Accountant | Date range | Excel | `tblfees_cancel` |
| Fee Refund Report | Fees → Reports | `/fees/reports/refund` | Admin, Accountant | Date range | Excel | `tblfees_refund` |
| Other Fees Report | Fees → Reports | `/fees/reports/other` | Admin, Accountant | Date range, Type | Excel | `other_fees_*` |
| Online Fees Report | Fees → Reports | `/fees/reports/online` | Admin, Accountant | Date range, Gateway | Excel | `fees_online_*` |
| NACH Report S1 | Fees → NACH | `/fees/NACH_s1excel_export` | Admin, Accountant | Bank, Date | Excel | NACH tables |
| NACH Report S3 | Fees → NACH | `/fees/NACH_s3excel_export` | Admin, Accountant | Bank | Excel | NACH tables |
| Fee Audit Trail | Fees → Audit | `/fees/audit-trail` | Admin, Auditor | Date range, User | On-screen, Excel | `tblfeescollect` audit |
| Teacher Dues | Fees → Teacher Dues | `/fees/teacher-dues` | Admin, Accountant | Department | Excel | `fees_*`, `tblstaff` |
| Fees Communication Log | Fees → Communication | `/fees/communication` | Admin, Accountant | Date range | On-screen | `email_sent_parents` |

---

## Exam / Result Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Student Report Card | Result | `result/*` | Admin, Class Teacher | Standard, Division, Exam | PDF | `result_*` |
| Marks Entry Sheet | Result | `result/*` | Teacher, Admin | Subject, Class, Exam | Excel | `result_marks*` |
| Progress Report | Exam | `exam/*` | Admin, Teacher | Academic year, Standard | PDF | `result_*` |
| Co-scholastic Report | Result | `result/*` | Admin, Class Teacher | Standard, Exam | PDF | `result_co_scholastic_*` |
| Toppers List | Result | TBD | Admin, Principal | Exam, Standard | Excel, PDF | TBD |
| Learning Outcome Report | Learning Outcome | `/learning-outcome/*` | Admin, Teacher | Subject, Chapter | Excel | `learning_outcome_*` |

---

## Library Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Book Circulation Report | Library | `/library/*` | Librarian, Admin | Date range, Category | Excel | `library_book_circulations` |
| Overdue Books | Library | `/library/*` | Librarian | Date | Excel | `library_book_circulations` |
| Book Stock Report | Library | `/library/*` | Librarian, Admin | Category, Author | Excel | `library_books`, `library_items` |

---

## Hostel Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Room Allocation Report | Hostel | `/hostel/*` | Hostel Admin | Block, Floor | Excel | `hostel_room_allocation` |
| Hostel Visitor Report | Hostel | `/hostel/*` | Hostel Admin | Date range | Excel | `hostel_visitor_master` |
| Occupancy Report | Hostel | `/hostel/*` | Admin | Academic year, Block | Excel | `hostel_room_master` |

---

## Transportation Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Route-wise Student Report | Transport | `/Transportation/*` | Transport Admin | Route | Excel | transport tables |
| Vehicle Log | Transport | `/Transportation/*` | Transport Admin | Date range, Vehicle | Excel | transport tables |

---

## Inventory Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Stock Report | Inventory | `/Inventory/*` | Store Keeper | Category, Date | Excel | `inventory_item_master` |
| Purchase Order Report | Inventory | `/Inventory/*` | Store Keeper, Admin | Date range, Vendor | Excel | inventory PO tables |
| Allocation Report | Inventory | `/Inventory/*` | Admin | Date range, Department | Excel | `inventory_allocation` |

---

## Communication Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| SMS / Email Sent Log | Easy Com | `/easy_com/*` | Admin | Date range, Type | Excel | `email_sent_parents`, `gcm_users` |
| WhatsApp Message Log | Easy Com | `/easy_com/*` | Admin | Date range | Excel | `whatsapp_sent_messages` |
| Circular Report | Front Desk | `/front_desk/circular/report` | Admin | Date range, Type | Excel, PDF | `circular_master` |

---

## SQAA Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| SQAA Document Report | SQAA | `/sqaa_document_report` | Admin, Principal | Year | PDF, Excel | `sqaa_documents` |

---

## Admin Services Reports

| Report Name | Menu | Frontend Route | Roles | Key Filters | Export | Data Source |
|---|---|---|---|---|---|---|
| Visitor Report | Admin Services | `/admin-services/visitor*` | Admin, Receptionist | Date range | Excel | `visitor_management` |
| PTM Report | Admin Services | `/admin-services/ptm*` | Admin, Teacher | Date range, Class | Excel | `ptm*` |
| Complaint Report | Admin Services | `/admin-services/complaint*` | Admin | Date range, Status | Excel | admin_services tables |

---

> Detailed docs: `docs/v1/core/reports/<report-name>.md` (to be written per report)

---

## Source files

- Frontend reports routes: `C:\rajesh\lms_k12\app\**\page.tsx` (report sub-routes)
- Backend report controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\report\*`
- Fees report controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\fees\fees_report*`
- Export classes: `F:\xampp\htdocs\next_lms_erp\app\Exports\`
