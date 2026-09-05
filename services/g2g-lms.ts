/**
 * LMS (People & Competency) — barrel re-export point.
 *
 * Mirrors services/organization.ts's convention exactly: a thin flat file
 * that re-exports the real domain logic living under
 * components/domain/lms/<feature>/<feature>-service.ts. This file is a
 * PACKAGE 0 (shared scaffolding) skeleton only — packages 1-4 add their own
 * export line below as they build each of the 9 screens. Keep one line (plus
 * its type export, if any) per feature, grouped by the screen it backs.
 *
 * Target screens (app/people-competency/lms/**):
 *   learning-dashboard, learning-catalog, my-learning, assignments,
 *   sessions-calendar, certifications-records, course-builder,
 *   administration-governance, assessments
 */

export { lmsDashboardService } from '@/components/domain/lms/dashboard/dashboard-service';
export { lmsCatalogService } from '@/components/domain/lms/catalog/catalog-service';
export { lmsLearningService } from '@/components/domain/lms/delivery/learning-service';

export { lmsAssignmentsService } from '@/components/domain/lms/assignments/assignments-service'
export { lmsSessionsCalendarService } from '@/components/domain/lms/sessions-calendar/sessions-calendar-service'

export { lmsCertificationsRecordsService } from '@/components/domain/lms/certifications-records/certifications-records-service';
export { lmsCourseBuilderService } from '@/components/domain/lms/course-builder/course-builder-service';
export { aiCourseService } from '@/components/domain/lms/course-builder/ai-course-service';

export { lmsAdministrationGovernanceService } from '@/components/domain/lms/administration-governance/administration-governance-service'
export { lmsAssessmentsService } from '@/components/domain/lms/assessments/assessments-service'
