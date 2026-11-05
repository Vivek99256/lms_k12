# Scholar Suite — Version 1 Product Bible

Last updated: 2026-11-03
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> This index is the master table of contents for the Scholar Suite v1 documentation.
> Every module, menu, frontend route, backend controller and key table is mapped to one of the five products.
> Use the links below to navigate. Files are written one product at a time; tick marks show completion status.

---

## Products at a glance

| Slug | Product | What it covers | Modules |
|---|---|---|---|
| [core](/docs/1.0.0/core) | Scholar Core | Institute ERP | Admissions, Student, Attendance, Academic Setup, Timetable, Fees, Exam/Result, Library, Hostel, Transport, Inventory, Communication, Admin Services, SQAA, Alumni, Inward-Outward |
| [learn](/docs/1.0.0/learn) | Scholar Learn | LMS + PAL | LMS, PAL, H5P Content, Curriculum, Assessment, Learning Outcomes |
| [ccb](/docs/1.0.0/ccb) | Scholar CCB | People & Competency | HRIT (Attendance/Leave/Payroll), Talent Management, Capability Intelligence, Organization Management, G2G LMS |
| [insight](/docs/1.0.0/insight) | Scholar Insight | Enterprise Brain | AI Administration, Enterprise Brain, Agentic AI, Dynamic Reports |
| [compass](/docs/1.0.0/compass) | Scholar Compass | Career Counselling | Career Awareness, Career Explorer, Career Intelligence, O*NET Data |
| [_shared](/docs/1.0.0/_shared) | Shared Platform | Auth, RBAC, Settings, Notifications, AI Providers, Platform Services | Auth, Users, Roles/Permissions, Notifications, Document Templates, Form Builder, Bulk Upload, Platform Services |

---

## Full Menu → Product Map

### Scholar Core (`core`)

| Module | Menu / Sub-menu | Frontend Route | Backend Controller(s) |
|---|---|---|---|
| **Admissions** | Dashboard | `/admissions/dashboard` | AdmissionsDashboardApiController |
| | Enquiry | `/admissions/admission_enquiry` | admission/* |
| | Registration | `/admissions/admission_registration`, `/admissions/registration` | admission/* |
| | Admission Form | `/admissions/admission_form` | admission/* |
| | Confirmation | `/admissions/admission_confirmation`, `/admissions/confirmation` | admission/* |
| | Follow-up | `/admissions/admission_followUp` | admission/* |
| | Reports | `/admissions/admission_reports/*` | admission/* |
| | AI Stack | `/admissions/ai-stack` | BrainAdmissionsIntelligenceController |
| **Student** | Add Student | `/student/add_student` | tblstudentController |
| | Search Student | `/students/search_student` | tblstudentController |
| | Dashboard | `/students/dashboard` | StudentsDashboardApiController |
| | ID Cards | `/students/ICards`, `/student/student_icard`, `/student/my_icard` | studentIcardController |
| | Documents | `/students/student_documents` | tblstudent_doc |
| | Discipline | `/students/discipline`, `/student/dicipline` | student/* |
| | Health / Medical | `/students/health_medical`, `/student/student_health` | studentHealthController |
| | Infirmary | `/student/student_infirmary` | studentInfirmaryController |
| | House | `/students/house`, `/student/add_house` | student/* |
| | Leave | `/students/leave` | student/* |
| | Vaccination | `/student/student_vaccination` | studentVaccinationController |
| | Certificate | `/student/student_certificate` | studentCertificateController |
| | Optional Subject | `/student/student_optional_subject` | student/* |
| | Quota | `/student/student_quota` | student/* |
| | Bulk Update | `/student/bulk_student_update` | studentBulkUpdateController |
| | Requests | `/students/requests/*` | student/* |
| | Reports | `/student/report/*` | student/* |
| | AI Stack | `/students/intelligence` | BrainStudentIntelligenceController |
| **Attendance** | Student Attendance | `/student/student_attendance`, `/student/daywise_student_attendance`, `/student/monthwise_student_attendance`, `/student/yearly_student_attendance` | studentAttendanceController |
| | Face Attendance | `/face_attendance/*` | biomatrixController |
| | Dashboard | `/attendance/attendance_dashboard` | StudentsDashboardApiController |
| | AI Stack | `/attendance/ai-stack` | BrainAttendanceIntelligenceController |
| **Academic Setup** | Batch | `/academic_setup/create_batch` | batchController |
| | Periods | `/academic_setup/create_periods` | periodController |
| | Subjects | `/academic_setup/create_subject`, `/subjects/*` | subjectController |
| | Standard-Division Mapping | `/academic_setup/standard_division_mapping` | school_setup/* |
| | Subject-Standard Mapping | `/academic_setup/subject_standard_mapping` | school_setup/* |
| | Division Capacity | `/academic_setup/division_capacity_mapping` | school_setup/* |
| | Elective Mapping | `/academic_setup/subject-elective-mapping` | school_setup/* |
| | Chapter Management | `/chapters` | chapterController |
| | Class Teacher | `/classteacher` | classteacherController |
| | Proxy | `/proxy_master`, `/proxy_report` | proxyController |
| **Timetable / Front Desk** | Timetable | `/front_desk/create-timetable`, `/front_desk/classwisetimetable`, `/front_desk/facultywisetimetable` | timetableController |
| | Exam Schedule | `/front_desk/exam_schedule` | school_setup/* |
| | Circular | `/front_desk/circular` | front_desk/* |
| | Leave Application | `/front_desk/leave_application` | front_desk/* |
| | Parent Communication | `/front_desk/parent_communication` | front_desk/* |
| | Photo / Video Gallery | `/front_desk/photo_video_gallary` | front_desk/* |
| | Calendar | `/front_desk/calendar` | calendar/* |
| **Fees** | Dashboard | `/fees/dashboard` | FeesDashboardApiController |
| | Collect Fee | `/fees/collect`, `/fees/collect/[studentId]` | fees_collect/* |
| | Online Fees | `/fees/online_fees_collect`, `/fees/online-fees-settings` | online_fees/* |
| | Other Fees | `/fees/other_fees_collect`, `/fees/other_fees_cancel` | other_fees_* |
| | Cancel / Refund | `/fees/cancel-refund` | fees_cancel/* |
| | Master Setup | `/fees/master/*`, `/fees/master-setup` | tblfeesConfigController |
| | Map Year | `/fees/map_year` | fees/* |
| | NACH S1–S4 | `/fees/NACH_s*` | NACH/* |
| | Fees Circulars | `/fees/circulars` | fees/* |
| | Communication | `/fees/communication` | fees/* |
| | Breakoff Update | `/fees/update-fees-breakoff` | fees/* |
| | Audit Trail | `/fees/audit-trail` | fees/* |
| | Teacher Dues | `/fees/teacher-dues` | TeacherFeeDuesApiController |
| | Scheduler | `/fees/scheduler` | fees/* |
| | Reports | `/fees/reports/*` | fees_report/* |
| | AI Stack | `/fees/ai-stack` | BrainFeesIntelligenceController, feesAIController |
| **Exam / Result** | Grade Master | `result/*` | result/* |
| | Marks Entry | `result/*`, `exam/*` | result/*, lmsexamController |
| | Report Cards | `result/*` | result/* |
| | Result Templates | `result/*` | result/* |
| | Approval | `result/*` | result/* |
| | Progress Report | `exam/*` | result/* |
| | Learning Outcome | `/learning-outcome/*` | learning_outcome/* |
| **Library** | All Library | `/library/*` | BookController, LibraryReportController, itemScanController |
| **Hostel** | All Hostel | `/hostel/*` | hostel_management/* |
| **Transportation** | All Transport | `/Transportation/*` | transportation/* |
| **Inventory** | All Inventory | `/Inventory/*` | inventory/* |
| **Admin Services** | Front Desk | `/admin-services/*` | admin_services/* |
| | Visitor Management | `/admin-services/visitor*` | visitor_management/* |
| | Complaint | `/admin-services/complaint*` | admin_services/* |
| | Consent | `/admin-services/consent*` | consent/* |
| | PTM | `/admin-services/ptm*` | ptm/* |
| | Petty Cash | `/admin-services/petty-cash*` | admin_services/* |
| **Communication (Easy Com)** | SMS / Email / WhatsApp / Push | `/easy_com/*` | easy_com/*, WhatsappController |
| **Inward / Outward** | Register | `/inward_outward/*` | inward_outward/ |
| **Document Library** | Documents | `/documents/*`, `/document-templates/*` | FileController, DocumentTemplate |
| **SQAA** | SQAA Master | `/sqaa_master`, `/sqaa/*` | sqaa/ |
| | Document Report | `/sqaa_document_report` | sqaa/ |
| **Alumni** | All Alumni | `/alumni/*`, `/alumni-portal/*` | AlumniMasterExport |
| | Alumni Portal Auth | `/alumni-portal/login`, `/alumni-portal/register`, `/alumni-portal/reset-password` | AlumniMasterExport |
| **Organization** | Employee Directory | `/organization-management/*` | OrganizationManagement/ |
| | Department | `/organization_managment/*` | OrganizationManagement/ |

---

### Scholar Learn (`learn`)

| Module | Menu / Sub-menu | Frontend Route | Backend Controller(s) |
|---|---|---|---|
| **LMS** | Teacher Dashboard | `/lms/teacher-dashboard` | lmsDashboardController |
| | Lesson Plan | `/lms/lesson-plan` | lmsLessonPlanController |
| | Curriculum Planning | `/lms/curriculum-planning` | lmsCurriculumController |
| | Homework | `/lms/homework/*` | lmsHomeworkController |
| | Assignment | `/lms/lmsAssignment`, `/lms/lmsAnnotate_assignment` | lms/assignment/* |
| | Project | `/lms/lmsProject` | lms/* |
| | Worksheet | `/lms/lmsWorksheet` | lms/* |
| | Teacher Resource | `/lms/lms_teacherResource` | lms/teacher_resource/* |
| | Online Exam | `/lms/exam`, `/lms/exam/evaluation/*` | lmsexamController |
| | Virtual Classroom | `/lms/virtual-classroom` | lmsVirtualClassroomController |
| | Social Collaborative | `/lms/social-collaborative` | lmsSocialCollabrotiveController |
| | Portfolio | `/lms/portfolio` | lmsPortfolioController |
| | Activity Stream | `/lms/activity-stream` | lmsActivityStreamController |
| | Leaderboard | `/lms/leader-board`, `/lms/leader-board-master` | lmsLeaderboardController |
| | Global Mapping | `/lms/global-mapping` | lms/* |
| | Syllabus Plan | `/lms/syllabus-plan` | lmsSyllabusController |
| | Monthly Plan | `/lms/monthly-plan` | lms/* |
| | Teacher Diary | `/lms/teacher-diary` | lms/* |
| | Teacher Timetable | `/lms/teacher-timetable` | lms/* |
| | Book List | `/lms/book-list` | lms/library/* |
| | Reports | `/lms/reports`, `/lms/question-wise-report`, `/lms/student-analysis/*` | lms/* |
| | AI Stack | `/lms/ai-stack`, `/lms/homework/intelligence` | BrainHomeworkIntelligenceController |
| **H5P Content** | MCQ | `/h5p/h5p_mcq` | lms/h5p/* |
| | Fill in Blanks | `/h5p/h5p_blanks` | lms/h5p/* |
| | Drag Drop | `/h5p/h5p_drag_drop` | lms/h5p/* |
| | True/False | `/h5p/h5p_true_false` | lms/h5p/* |
| | Memory Game | `/h5p/h5p_memory_game` | lms/h5p/* |
| | Interactive Video | `/h5p/h5p_interactive_video` | lms/h5p/* |
| | Branching Scenario | `/h5p/h5p_branching_scenario` | lms/h5p/* |
| | Course Presentation | `/h5p/h5p_course_presentation` | lms/h5p/* |
| | Question Bank Library | `/h5p/question-bank-library` | questionmasterController |
| **PAL** | PAL Home | `/pal`, `/pal/new` | lms/pal/* |
| | Content Model | `/pal/new/content-model/*` | PedagogyEngineController, chapterController |
| | Coherence Map | `/pal/new/coherence-map` | lms/pal/* |
| | Gamification | `/pal/new/gamification/*` | lms/pal/* |
| | Frameworks | `/pal/frameworks`, `/pal/frameworks/[slug]` | lms/pal/* |
| | ULU | `/pal/ulu`, `/pal/ulu/[slug]` | lms/pal/* |
| | Pedagogy Engine | `/pal/pedagogy-engine` | PedagogyEngineController |
| | ESO | `/pal/eso` | lms/pal/* |
| | Exam / Result / Recall | `/pal/exam`, `/pal/result`, `/pal/recall` | lms/pal/* |
| | Reports | `/pal/report`, `/pal/reports/activity`, `/pal/reports/attainment` | lms/pal/* |
| | Mastery | `/pal/mastery/chapter/*`, `/pal/mastery/concept/*` | lms/pal/* |
| | Intervention | `/pal/intervention/*` | lms/pal/* |
| | AI Stack | `/pal/new/ai-stack`, `/pal/intelligence` | packages/ai-intelligence-core |
| **Assessment / Quiz** | Quiz | `/quiz/*` | assessmentQuestionController |
| | Question Paper | (from `/h5p/question-bank-library`) | questionpaperController |
| **Learning Outcomes** | All | `/learning-outcome/*` | learning_outcome/* |
| **Course Master** | All | `/course-master/*` | lms/* |
| **Teach & Learn** | All | `/teach-learn/*` | lms/* |
| **Engagement** | Activity | `/engagement/activity` | lms/*, lmsActivityStreamController |

---

### Scholar CCB (`ccb`)

| Module | Menu / Sub-menu | Frontend Route | Backend Controller(s) |
|---|---|---|---|
| **HRIT — Attendance** | Attendance Tracking | `/hrit/attendance-management/*` | HrmsController, HrmsMobileApiController |
| | Attendance Reports | `/hrit/attendance-management/reports` | HRMS/* |
| **HRIT — Leave** | Leave Dashboard | `/hrit/leave-management/dashboard` | HrmsLeaveController |
| | Leave Requests | `/hrit/leave-management/requests` | HrmsLeaveController |
| | Leave Reports | `/hrit/leave-management/reports` | HrmsLeaveController |
| | Leave Configuration | `/hrit/leave-management/configuration` | HrmsLeaveController |
| **HRIT — Payroll** | Payroll Type | `/hrit/payroll-management/*` | PayrollController |
| | Salary Structure | `/hrit/payroll-management/*` | PayrollController |
| | Payroll Deduction | `/hrit/payroll-management/*` | PayrollController |
| | Form 16 | `/hrit/payroll-management/*` | PayrollController |
| | Salary Certificate | `/hrit/payroll-management/*` | PayrollController |
| | Monthly Payroll Report | `/hrit/payroll-management/*` | PayrollController |
| **Talent Management** | Dashboard | `/talent-management/dashboard` | TalentManagement/* |
| | Recruitment | `/talent-management/recruitment` | TalentManagement/* |
| | Onboarding | `/talent-management/onboarding` | TalentManagement/* |
| | Performance & Appraisals | `/talent-management/performance` | TalentManagement/* |
| | Compensation | `/talent-management/compensation` | TalentManagement/* |
| | Mobility & Succession | `/talent-management/mobility` | TalentManagement/* |
| | Offboarding | `/talent-management/offboarding` | TalentManagement/* |
| | Administration | `/talent-management/administration` | TalentManagement/* |
| **Capability Intelligence** | Dashboard | `/capability-intelligence/dashboard` | OrganizationManagement/* |
| | Competency Library | `/capability-intelligence/competency-library` | skill/* |
| | Capability Library | `/capability-intelligence/capability-library` | skill/* |
| | Competency Framework | `/capability-intelligence/competency-framework` | skill/* |
| | Capability Explorer | `/capability-intelligence/capability-explorer` | skill/* |
| **G2G LMS** | Learning Dashboard | `/people-competency/lms/dashboard` | G2gLms/* |
| | Learning Catalog | `/people-competency/lms/catalog` | G2gLms/* |
| | My Learning | `/people-competency/lms/my-learning` | G2gLms/* |
| | Assignments | `/people-competency/lms/assignments` | G2gLms/* |
| | Sessions & Calendar | `/people-competency/lms/sessions` | G2gLms/* |
| | Certifications | `/people-competency/lms/certifications` | G2gLms/* |
| | Course Builder | `/people-competency/lms/course-builder` | G2gLms/* |
| | Admin & Governance | `/people-competency/lms/admin` | G2gLms/* |
| | Assessments | `/people-competency/lms/assessments` | G2gLms/* |
| **Organization Management** | Employee Directory | `/organization-management/*` | OrganizationManagement/* |
| | Roles & Permissions | `/general/groupwise_rights` | MenuRightsController |
| | Disciplinary | `/organization-management/disciplinary*` | OrganizationManagement/* |
| | Compliance | `/organization-management/compliance*` | OrganizationManagement/* |
| **Task Management** | Dashboard | `/task-management/dashboard` | TaskManagement/* |
| | My Tasks | `/task-management/my-tasks` | TaskManagement/* |
| | Projects & Workstreams | `/task-management/projects` | TaskManagement/* |
| | Task Calendar | `/task-management/calendar` | TaskManagement/* |
| | Reports & Analysis | `/task-management/reports` | TaskManagement/* |
| | Administration | `/task-management/administration` | TaskManagement/* |

---

### Scholar Insight (`insight`)

| Module | Menu / Sub-menu | Frontend Route | Backend Controller(s) |
|---|---|---|---|
| **AI Administration** | Providers | `/ai/providers` | AiConfigurationController |
| | Model Management | `/ai/models` | AiConfigurationController |
| | Prompt Management | `/ai/prompts/*` | AiTemplateController |
| | AI Policies | `/ai/policies` | AiPolicyController |
| | Agent Management | `/enterprise-brain/automation/agents` | AgentController, agenticAI/* |
| | Conversational AI | `/enterprise-brain/automation/conversational-ai` | ChatbotController |
| | Knowledge & RAG | `/enterprise-brain/knowledge/*` | KnowledgeRagController |
| | Recommendations | (via brain) | RecommendationController |
| | Knowledge Graph | `/enterprise-brain/knowledge/knowledge-graph` | neo4J/*, GraphController |
| | AI Evaluation | (via brain) | AiController |
| | Usage & Cost | `/ai/usage-cost` | AiController |
| | AI Audit | `/ai/audit` | AiController |
| | AI Guardrails | `/ai/guardrails` | AiPolicyController |
| **Enterprise Brain** | Analytics — Executive | `/enterprise-brain/analytics/executive` | BrainController |
| | Analytics — Decisions | `/enterprise-brain/analytics/decisions` | BrainIntelligenceController |
| | Analytics — Decision Intelligence | `/enterprise-brain/analytics/decision-intelligence` | BrainIntelligenceController |
| | Analytics — Mental Models | `/enterprise-brain/analytics/mental-models` | BrainIntelligenceController |
| | Intelligence Loop — Signals | `/enterprise-brain/intelligence-loop/signals` | BrainIntelligenceController |
| | Intelligence Loop — Evidence | `/enterprise-brain/intelligence-loop/evidence` | BrainIntelligenceController |
| | Intelligence Loop — Executions | `/enterprise-brain/intelligence-loop/executions` | BrainIntelligenceController |
| | Intelligence Loop — Deliberation | `/enterprise-brain/intelligence-loop/deliberation` | BrainIntelligenceController |
| | Intelligence Loop — Workspace | `/enterprise-brain/intelligence-loop/workspace` | WorkspaceController |
| | Foundation — Departments | `/enterprise-brain/foundation/departments` | BrainController |
| | Foundation — People | `/enterprise-brain/foundation/people` | BrainController |
| | Foundation — Students | `/enterprise-brain/foundation/students` | BrainController |
| | AI Governance | `/enterprise-brain/governance` | BrainController |
| | Data Ingestion | `/enterprise-brain/ingestion` | BrainIntelligenceIntegrationController |
| | Capabilities | `/enterprise-brain/capabilities`, `/enterprise-brain/capabilities/[id]` | CapabilityController |
| | Settings | `/enterprise-brain/settings` | BrainController |
| **Module-level AI Stacks** | (Per-module intelligence) | `/<module>/intelligence` or `/<module>/ai-stack` | Brain*IntelligenceController |
| **Dynamic Reports** | Report Builder | `/reports/dynamic-report-builder` | ReportDynamic, ReportController |
| | AI Reports | `/ai-reports/[id]` | ReportController |

---

### Scholar Compass (`compass`)

| Module | Menu / Sub-menu | Frontend Route | Backend Controller(s) |
|---|---|---|---|
| **Career Counselling** | Interest Profile | `/career-counselling/interest-profile` | lmsCounsellingController |
| | Knowing Yourself | `/career-counselling/knowing-yourself` | lmsCounsellingController |
| **Career Awareness** | Alignment | `/career-awareness/alignment` | ONetOnlineDataController |
| | Ambition | `/career-awareness/ambition` | ONetOnlineDataController |
| | Certainty | `/career-awareness/certainty` | ONetOnlineDataController |
| | Originality | `/career-awareness/originality` | ONetOnlineDataController |
| **Career Explorer** | Sectors | `/career-explorer/sectors` | ONetOnlineDataController |
| | Colleges | `/career-explorer/college` | ONetOnlineDataController |
| | Courses | `/career-explorer/courses` | ONetOnlineDataController |
| | Employers | `/career-explorer/employers` | ONetOnlineDataController |
| | Expert Advice | `/career-explorer/expert-advice` | ONetOnlineDataController |
| **Career Intelligence** | All | `/career-intelligence` | BrainController |

---

### Shared Platform (`_shared`)

| Module | Menu / Sub-menu | Frontend Route | Backend Controller(s) |
|---|---|---|---|
| **Auth** | Login | `/login` | loginController, ApiLoginController |
| | Forgot Password | `/forgot-password` | loginController |
| | Google OAuth | (via AuthContext) | loginController |
| | Mobile Bridge | `/mobile-bridge` | MobileWebHandoffApiController |
| **User Management** | Add User | `/user/add_user` | user/* |
| | User Profiles | `/general/user_profile_masters` | user/* |
| | User Report | `/user/user_report` | user/* |
| | User Log | `/user_log` | user/* |
| **RBAC** | Group Rights | `/general/groupwise_rights` | MenuRightsController |
| | Individual Rights | `/general/individual_rights` | MenuRightsController |
| | Mobile App Rights | `/general/mobile_app_rights` | MenuRightsController |
| **Settings** | Field Configuration | `/general/fields_configuration` | configurationController |
| | Template Management | `/general/template_management` | DocumentTemplate |
| | Form Builder | `/general/form_builder` | FormTable |
| | Bulk Upload | `/general/bulk_upload` | Import/* |
| | Onboarding | `/general/onboarding/[module]` | implementation/* |
| | Process Library | `/general/add_process` | implementation/* |
| | Implementation | `/general/implementation_management` | implementation/* |
| | Native Dynamic Pages | `/general/native_dynamic_pages` | MobileDynamicPageAdminApiController |
| **Platform Services** | Dashboard | `/platform-services/dashboard` | Platform/* |
| | Notifications | `/platform-services/notification` | Platform/* |
| | Scheduler | `/platform-services/scheduler` | Platform/* |
| | Workflow | `/platform-services/workflow` | Platform/* |
| | Audit | `/platform-services/audit` | AuditLog |
| | Event Bus | `/platform-services/event-bus` | Platform/* |
| | Files / Documents | `/platform-services/files` | FileController |
| | Reports | `/platform-services/reports` | Platform/* |
| **Integration** | All | `/integration/*` | api/* |
| **Public Payments** | Online Payment | `/pay/[code]` | online_fees/* |

---

## Scale Summary

| Product | Frontend Routes | Backend Controllers | DB Tables (approx) |
|---|---|---|---|
| Scholar Core | ~180 | ~120 | ~120 |
| Scholar Learn | ~100 | ~50 | ~70 |
| Scholar CCB | ~55 | ~30 | ~50 |
| Scholar Insight | ~40 | ~35 | ~60 |
| Scholar Compass | ~12 | ~5 | ~20 |
| _shared | ~35 | ~40 | ~30 |
| _unmapped | ~8 | ~5 | ~5 |
| **Total** | **~430** | **~285** | **~355+** |

---

## Documentation Completion Status

| File | Status |
|---|---|
| `README.md` (this file) | Complete |
| `_unmapped.md` | Complete |
| `GLOSSARY.md` | Complete |
| `ROLES-PERMISSIONS.md` | Complete |
| `DATA-MODEL.md` | Complete |
| `API-REFERENCE.md` | Complete |
| `DECISIONS.md` | Complete |
| [core/README.md](/docs/1.0.0/core) | Complete |
| `core/REPORTS.md` | Complete |
| [learn/README.md](/docs/1.0.0/learn) | Complete |
| `learn/REPORTS.md` | Complete |
| [ccb/README.md](/docs/1.0.0/ccb) | Complete |
| `ccb/REPORTS.md` | Complete |
| [insight/README.md](/docs/1.0.0/insight) | Complete |
| `insight/REPORTS.md` | Complete |
| [compass/README.md](/docs/1.0.0/compass) | Complete |
| `compass/REPORTS.md` | Complete |
| [_shared/README.md](/docs/1.0.0/_shared) | Complete |
| Per-menu `.md` files | Complete (196+ markdown files) |
| `views/` role summaries | Complete |

---

## Source files

- Frontend app dir: `C:\rajesh\lms_k12\app\`
- Frontend header/nav: `C:\rajesh\lms_k12\app\components\Header.tsx`
- Frontend packages: `C:\rajesh\lms_k12\packages\`
- Backend API routes: `F:\xampp\htdocs\next_lms_erp\routes\api.php`
- Backend controllers: `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\`
- Backend models: `F:\xampp\htdocs\next_lms_erp\app\Models\`
- Menu schema migration: `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_tblmenumaster_table.php`
- Menu data migrations: `F:\xampp\htdocs\next_lms_erp\database\migrations\2026_08_17_*`, `2026_08_18_*`, `2026_08_20_*`, `2026_08_24_*`, `2026_09_05_*`, `2026_09_10_*`, `2026_09_11_*`
