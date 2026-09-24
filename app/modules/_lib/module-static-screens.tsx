'use client';

import { ModuleCategoryPage, type ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ATTENDANCE_AI_STACK_SCREENS } from '@/app/attendance/ai-stack/_screens/ai-stack-screens';
import { COMPLAINT_AI_STACK_SCREENS } from '@/app/admin-services/complaint-ai-stack/_screens/ai-stack-screens';
import { PARENT_COMMUNICATION_AI_STACK_SCREENS } from '@/app/front_desk/parent_communication/ai-stack/_screens/ai-stack-screens';
import { SQAA_AI_STACK_SCREENS } from '@/app/sqaa/ai-stack/_screens/ai-stack-screens';
import { USERS_AI_STACK_SCREENS } from '@/app/user/ai-stack/_screens/ai-stack-screens';
import { LIBRARY_AI_STACK_SCREENS } from '@/app/library/ai-stack/_screens/ai-stack-screens';
import { LMS_AI_STACK_SCREENS } from '@/app/lms/ai-stack/_screens/ai-stack-screens';
import { INSTITUTE_AI_STACK_SCREENS } from '@/app/organization-management/ai-stack/_screens/ai-stack-screens';
import { CONSENT_AI_STACK_SCREENS } from '@/app/admin-services/consent-ai-stack/_screens/ai-stack-screens';
import { CURRICULUM_PLANNING_AI_STACK_SCREENS } from '@/app/lms/curriculum-planning/ai-stack/_screens/ai-stack-screens';
import { ENGAGEMENT_AI_STACK_SCREENS } from '@/app/engagement/ai-stack/_screens/ai-stack-screens';
import { EXAM_ASSESSMENT_AI_STACK_SCREENS } from '@/app/exam-assessment/ai-stack/_screens/ai-stack-screens';
import { INTERACTIONS_AI_STACK_SCREENS } from '@/app/interactions/ai-stack/_screens/ai-stack-screens';
import { NEW_PAL_AI_STACK_SCREENS } from '@/app/pal/new/ai-stack/_screens/ai-stack-screens';
import { PETTY_CASH_AI_STACK_SCREENS } from '@/app/admin-services/petty-cash-ai-stack/_screens/ai-stack-screens';
import { PTM_AI_STACK_SCREENS } from '@/app/admin-services/ptm-ai-stack/_screens/ai-stack-screens';
import { VISITOR_AI_STACK_SCREENS } from '@/app/admin-services/visitor-ai-stack/_screens/ai-stack-screens';
import { ADMISSIONS_AI_STACK_SCREENS } from '@/app/admissions/ai-stack/_screens/ai-stack-screens';
import { COMMUNICATION_AI_STACK_SCREENS } from '@/app/easy_com/ai-stack/_screens/ai-stack-screens';
import { EXAM_AI_STACK_SCREENS } from '@/app/exam/ai-stack/_screens/ai-stack-screens';
import { CIRCULAR_AI_STACK_SCREENS } from '@/app/front_desk/circular/ai-stack/_screens/ai-stack-screens';
import { TIMETABLE_AI_STACK_SCREENS } from '@/app/front_desk/create-timetable/ai-stack/_screens/ai-stack-screens';
import { HOSTEL_AI_STACK_SCREENS } from '@/app/hostel/ai-stack/_screens/ai-stack-screens';
import { MOBILE_APPS_AI_STACK_SCREENS } from '@/app/mobile-apps/ai-stack/_screens/ai-stack-screens';
import { STUDENTS_AI_STACK_SCREENS } from '@/app/student/ai-stack/_screens/ai-stack-screens';
import { CERTIFICATE_AI_STACK_SCREENS } from '@/app/student/student_certificate/ai-stack/_screens/ai-stack-screens';
import { STUDENT_ICARD_AI_STACK_SCREENS } from '@/app/student/student_icard/ai-stack/_screens/ai-stack-screens';
import { STUDENT_MEDICAL_AI_STACK_SCREENS } from '@/app/student/student_infirmary/ai-stack/_screens/ai-stack-screens';
import { USER_ICARD_AI_STACK_SCREENS } from '@/app/student/user_icard/ai-stack/_screens/ai-stack-screens';
import { STUDENT_REQUEST_AI_STACK_SCREENS } from '@/app/students/requests/ai-stack/_screens/ai-stack-screens';
import { TRANSPORT_AI_STACK_SCREENS } from '@/app/Transportation/ai-stack/_screens/ai-stack-screens';
import { INWARD_AI_STACK_SCREENS } from '@/app/inward_outward/ai-stack/_screens/ai-stack-screens';
import { INVENTORY_AI_STACK_SCREENS } from '@/app/Inventory/ai-stack/_screens/ai-stack-screens';
import { FRONT_DESK_AI_STACK_SCREENS } from '@/app/front_desk/ai-stack/_screens/ai-stack-screens';
import { TASK_MANAGEMENT_AI_STACK_SCREENS } from '@/app/task-management/ai-stack/_screens/ai-stack-screens';
import { UTILITY_AI_STACK_SCREENS } from '@/app/Utility/ai-stack/_screens/ai-stack-screens';
import { DOCUMENT_TEMPLATES_AI_STACK_SCREENS } from '@/app/document-templates/ai-stack/_screens/ai-stack-screens';

/**
 * The built screens a module's category page renders inline, for the modules that have
 * some.
 *
 * WHY THIS EXISTS
 *
 * `/modules/[moduleKey]/[categoryKey]` serves the 62 seeded modules from one route, and
 * it is a server component. A static screen is a `render: () => ReactNode` closure, which
 * cannot cross the server/client boundary as a prop — so the dynamic route delegates to
 * this client component, which looks the screens up by module and category.
 *
 * FEES AND TEACH/LEARN ARE NOT IN HERE, AND SHOULD NOT BE. They predate this route and
 * keep their own pages under `/fees/…` and `/teach-learn/…`, passing their screens to
 * `ModuleCategoryPage` directly. The seeded `route` column is what points each module's
 * bar at the right place, so both conventions coexist. Folding a working module into this
 * table would be a change to a working module for no gain.
 *
 * A MODULE ABSENT FROM THIS TABLE BEHAVES EXACTLY AS IT DID BEFORE: no static tabs, and
 * the category's database menus alone. Adding a module here is additive by construction.
 *
 * RENDERED THROUGH THE SHARED `ModuleCategoryPage` (app/_components/module-category-page),
 * not the pared-down one under app/modules/_components. That distinction matters here
 * specifically: this route is also what serves onboarding, workflow, schedular, audit-trail,
 * process-builder and intelligence for every one of the 62 seeded modules — the shared
 * component is what turns each of those into the real screen (the onboarding journey, the
 * workflow console, …) instead of an empty tab strip. Pointing this at the other
 * ModuleCategoryPage silently drops all six for every module but Fees and Teach/Learn,
 * which reach it by their own dedicated routes instead of this one.
 */
const STATIC_SCREENS: Record<string, ModuleStaticScreen[]> = {
  // The keys are MENU slugs, not `ai_modules` keys: this table is looked up by what the
  // category route carries, and the level-2 menus are named "Admission", "Student",
  // "Student Request" and so on. Each screen list scopes its own AI calls to the module
  // key it imports rather than spelling one out here — `admission:` renders the
  // `admissions` module, `student:` renders `students`, and `student-request:` renders
  // `student_request`, which is a different module from both.
  'admission:ai-stack': ADMISSIONS_AI_STACK_SCREENS,
  // Restored 2026-09-29. A prior revert/reapply in this file's history deleted then
  // restored the hand-written screens under app/attendance/ai-stack/_screens/ without
  // ever re-adding this row, so the generic /modules/attendance/ai-stack route fell back
  // to Attendance's (empty) database-driven menus — "No screens available yet" — even
  // though the direct /attendance/ai-stack route and its nine tabs were fully live the
  // whole time. This is the same nine-tab hand-written screen list Fees's own pattern
  // uses, not a migration to the shared AiStackModule descriptor.
  'attendance:ai-stack': ATTENDANCE_AI_STACK_SCREENS,
  'certificate:ai-stack': CERTIFICATE_AI_STACK_SCREENS,
  'circular:ai-stack': CIRCULAR_AI_STACK_SCREENS,
  // `communication:` renders the `easy_com` module — the key this estate has always used
  // for it. See the page under app/easy_com/ai-stack for why it was not given a new one.
  'communication:ai-stack': COMMUNICATION_AI_STACK_SCREENS,
  'complaint:ai-stack': COMPLAINT_AI_STACK_SCREENS,
  'consent:ai-stack': CONSENT_AI_STACK_SCREENS,
  'curriculum-planning:ai-stack': CURRICULUM_PLANNING_AI_STACK_SCREENS,
  // `document-templates:` renders the module keyed `document-templates` — hyphen and all,
  // which is how `ai_modules` has spelled it since the workspace was seeded.
  'document-templates:ai-stack': DOCUMENT_TEMPLATES_AI_STACK_SCREENS,
  'engagement:ai-stack': ENGAGEMENT_AI_STACK_SCREENS,
  'exam:ai-stack': EXAM_AI_STACK_SCREENS,
  // `exam-assessment:` is the LMS's online-delivery domain (online exams, homework,
  // assignments, worksheets, projects) — the "Exam & Assesment" sidebar entry, tblmenumaster
  // id 276. Distinct from `exam:` above (Mark Entry / Results, id 67); see
  // lib/exam-assessment/exam-assessment-ai-stack.ts for the full account of why the two
  // names collide in prose but never in data.
  'exam-assessment:ai-stack': EXAM_ASSESSMENT_AI_STACK_SCREENS,
  'front-desk:ai-stack': FRONT_DESK_AI_STACK_SCREENS,
  'hostel:ai-stack': HOSTEL_AI_STACK_SCREENS,
  'institute:ai-stack': INSTITUTE_AI_STACK_SCREENS,
  'interactions:ai-stack': INTERACTIONS_AI_STACK_SCREENS,
  'inventory:ai-stack': INVENTORY_AI_STACK_SCREENS,
  'library:ai-stack': LIBRARY_AI_STACK_SCREENS,
  'lms:ai-stack': LMS_AI_STACK_SCREENS,
  // `inward-outward:` renders the `inward_outward` module — the key this estate has always
  // used for it, hyphen in the slug and underscore in the key. See the page under
  // app/inward_outward/ai-stack for why it was not given a new one.
  'inward-outward:ai-stack': INWARD_AI_STACK_SCREENS,
  'mobile-apps:ai-stack': MOBILE_APPS_AI_STACK_SCREENS,
  // `new-pal:` renders the `new_pal` module — a distinct, richer module from the older
  // `pal` module. Before this row, `/pal/new/**` silently fell back to `pal`'s own tools.
  'new-pal:ai-stack': NEW_PAL_AI_STACK_SCREENS,
  // `parent-communication:` is the INBOUND direction and a different module from
  // `communication:` above, which is what the school sends.
  'parent-communication:ai-stack': PARENT_COMMUNICATION_AI_STACK_SCREENS,
  'petty-cash:ai-stack': PETTY_CASH_AI_STACK_SCREENS,
  'ptm:ai-stack': PTM_AI_STACK_SCREENS,
  'sqaa:ai-stack': SQAA_AI_STACK_SCREENS,
  'student:ai-stack': STUDENTS_AI_STACK_SCREENS,
  // `student-i-card:` and `user-i-card:` are two different modules. One prints a card for
  // a child from the student record, the other for a member of staff from the staff
  // record, and neither screen list can reach the other's tools.
  'student-i-card:ai-stack': STUDENT_ICARD_AI_STACK_SCREENS,
  'student-medical:ai-stack': STUDENT_MEDICAL_AI_STACK_SCREENS,
  'student-request:ai-stack': STUDENT_REQUEST_AI_STACK_SCREENS,
  /*
  | Task Management's level-2 menu exists per institute with a different id, so
  | `fees_menu_categories` carries a slug per institute rather than one shared slug —
  | `task-management-253` and `task-management-551` today. All of them map to the same
  | screen list: the tabs are identical and every call inside them is scoped by the module
  | key, not by the slug. A new institute adding its own level-2 menu needs a line here.
  */
  'task-management:ai-stack': TASK_MANAGEMENT_AI_STACK_SCREENS,
  'task-management-253:ai-stack': TASK_MANAGEMENT_AI_STACK_SCREENS,
  'task-management-551:ai-stack': TASK_MANAGEMENT_AI_STACK_SCREENS,
  'timetable:ai-stack': TIMETABLE_AI_STACK_SCREENS,
  // `transport:` renders the `transportation` module, for the same reason
  // `inward-outward:` renders `inward_outward`.
  'transport:ai-stack': TRANSPORT_AI_STACK_SCREENS,
  // `user:` and `user-i-card:` are two different modules over the same staff table:
  // one reads the ACCOUNT fields, the other the fields an identity card prints.
  'user:ai-stack': USERS_AI_STACK_SCREENS,
  'user-i-card:ai-stack': USER_ICARD_AI_STACK_SCREENS,
  // `utility:` renders the module keyed `migration-modules`, which has owned `/Utility/**`
  // since the workspace was seeded. In this ERP the Utility module is bulk data
  // operations, not electricity and water — see app/Utility/ai-stack for the whole note.
  'utility:ai-stack': UTILITY_AI_STACK_SCREENS,
  'visitor-management:ai-stack': VISITOR_AI_STACK_SCREENS,
};

export function ModuleCategoryRoute({
  moduleKey,
  categoryKey,
}: {
  moduleKey: string;
  categoryKey: string;
}) {
  const screens = STATIC_SCREENS[`${moduleKey}:${categoryKey}`];

  return (
    <ModuleCategoryPage
      moduleName={moduleKey}
      categoryKey={categoryKey}
      staticScreens={screens}
      // 'before' is the default and is right here: the AI Stack category has no database
      // menus of its own, so these tabs are what the category opens on. A category that
      // did have menus would need 'after', or a static tab would quietly take over its
      // landing screen.
    />
  );
}
