| # | Module | Page/Screen | Exact Field Name | Add/Edit/Create page | Route/Path | AI Available | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | LMS | Homework | Description | Create/Assign | `/lms/homework` | Yes | Working |
| 2 | LMS | Assignment | Description | Create | `/lms/lmsAssignment` | Yes | Working |
| 3 | LMS | Online Exam | Description | Create/Edit | `/lms/exam` | Yes | Working |
| 4 | LMS | Syllabus Plan | Objectives | Add/Edit | `/lms/syllabus-plan` | Yes | Working |
| 5 | LMS | Syllabus Plan | Learning Outcomes | Add/Edit | `/lms/syllabus-plan` | Yes | Working |
| 6 | LMS | Syllabus Plan | Suggested Materials | Add/Edit | `/lms/syllabus-plan` | Yes | Working |
| 7 | LMS | Syllabus Plan | Assessment Plan | Add/Edit | `/lms/syllabus-plan` | Yes | Working |
| 8 | Course Master | Lesson Plan | Learning objectives | Add/Edit | `/course-master/lesson-plan/[courseId]` | Yes | Working |
| 9 | Course Master | Chapters / Question Bank | Question Text | Add/Edit | `/course-master/[courseId]/chapters` | Yes | Working |
| 10 | Course Master | Chapters / Question Bank | Model Answer | Add/Edit | `/course-master/[courseId]/chapters` | Yes | Working |
| 11 | Course Master | Chapters | Chapter Description | Add/Edit | `/course-master/[courseId]/chapters` | Yes | Working |
| 12 | Exam | Exam Creation | Description | Create/Edit | `/exam/exam-creation` | Yes | Working |
| 13 | Quiz | Create Quiz | Question | Create | `/quiz/create` | Yes | Working |
| 14 | H5P | Flashcard | Question | Create | `/h5p/h5p_flashacard/create` | Yes | Working |
| 15 | H5P | Flashcard | Content / Explanation | Create | `/h5p/h5p_flashacard/create` | Yes | Working |
| 16 | H5P | Flashcard | Question | Edit | `/h5p/h5p_flashacard/[id]/edit` | Yes | Working |
| 17 | H5P | Flashcard | Content / Explanation | Edit | `/h5p/h5p_flashacard/[id]/edit` | Yes | Working |
| 18 | H5P | Scenario Based / Hotspot Modal | Description | Create | `/h5p/scenario_based` | Yes | Working |
| 19 | H5P | Scenario Based / Hotspot Modal | Description | Edit | `/h5p/scenario_based/[id]/edit` | Yes | Working |
| 20 | PAL | Content Authoring | Body | Create/Edit | `/pal/new/content-model/authoring` | Yes | Working |
| 21 | Easy Communication | Send Email Parents | Email content | Compose/Send | `/easy_com/send_email_parents` | Yes | Working |
| 22 | Easy Communication | Send Notification Parents | Notification text | Compose/Send | `/easy_com/send_notification_parents` | Yes | Working |
| 23 | Easy Communication | Send SMS Parents | SMS text | Compose/Send | `/easy_com/send_sms_parents` | Yes | Working |
| 24 | Easy Communication | Send SMS Staff | SMS text | Compose/Send | `/easy_com/send_sms_staff` | Yes | Working |
| 25 | Easy Communication | Send WhatsApp Parents | WhatsApp message | Compose/Send | `/easy_com/send_whatsapp_parents` | Yes | Working |
| 26 | Institute Detail | Department > Policies | Description | Add/Edit | `/Institute_Detail/Department` | Yes | Working |
| 27 | Institute Detail | Department > Rules | Rule Logic / Description | Add/Edit | `/Institute_Detail/Department` | Yes | Working |
| 28 | General | Add Process | Process | Add/Edit | `/general/add_process` | Yes | Working |
| 29 | General | Onboarding > Step Drawer | Notes | Edit | `/general/onboarding` | Yes | Working |
| 30 | General | Bulk Upload | Chapters (JSON array with chapter_name, chapter_desc, availability and show_hide) | Create | `/general/bulk_upload` | Yes | Working |
| 31 | General | Template Management | HTML Content | Add/Edit | `/general/template_management` | Yes | Working |
| 32 | General | User Profile Masters | Description | Add/Edit | `/general/user_profile_masters` | Yes | Working |
| 33 | Hostel | Type Master | Description | Add/Edit | `/hostel/type-master` | Yes | Working |
| 34 | Hostel | Admission Category Master | Description | Add/Edit | `/hostel/admission-category-master` | Yes | Working |
| 35 | Hostel | Hostel Master | Description | Add/Edit | `/hostel/hostel-master` | Yes | Working |
| 36 | Student | Student Health | Remarks | Add/Edit | `/student/student_health` | Yes | Working |
| 37 | Student | Student Discipline | Message | Add/Edit | `/student/dicipline` | Yes | Working |
| 38 | Student | Student Vaccination | Note | Add/Edit | `/student/student_vaccination` | Yes | Working |
| 39 | Admissions | Admission Enquiry | Remarks | Add/Edit | `/admissions/admission_enquiry` | Yes | Working |
| 40 | Library | Book Resources | Dynamic custom textarea field label(s) from ERP setup | Add/Edit | `/library/book_resources` | Yes | Working |

## Removed from the previously implied coverage

- `Result` module shared forms: no current Result screen defines a `textarea` field inside `DynamicForm`, so the AI icon is not currently shown there.
- `Result templates` and `Result book master` use `editor` fields, but `DynamicForm` only mounts `AiFieldAssistant` for `textarea`, not `editor`.
- `General / Form Builder`: the route switches to `FormBuilderEditor`, so the `GeneralPage` assistant wiring for `form_json` and `form_xml` is not the live UI there.
- `Hostel` custom fields: only built-in `textarea` config fields get the assistant; backend-driven custom hostel textareas do not currently render it.

## Notes

- `Library / Book Resources` is dynamic: the assistant appears only for custom fields returned by the backend with `field_type === 'textarea'`, so the exact field label varies by institute configuration.
- `General / Onboarding` uses the same `StepDrawer` note field in the onboarding experience; the main entry route is `/general/onboarding`.
