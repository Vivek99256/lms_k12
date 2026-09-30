# part09 data - Dead code / unused exports / reference material

Method: import graph over 2223 tracked TS/TSX/JS/MJS files (static import, export-from, dynamic import(), require, import-type; aliases @/*, @shared/conversational-ai-core/*, @shared/ai-intelligence-core[/*] resolved; case-sensitive resolution: 0 unresolved internal specifiers, 0 case mismatches). Roots: every Next convention file under app/ (page, layout, route, loading, error, not-found, ... = 757 files), next.config.ts, scripts/*. Test roots (*.test.ts, 42) computed separately. "Dead" = not reachable from any root. NOTE: app/_lib/module-screens.generated.ts dynamically imports 517 pages, which keeps pages reachable but they are pages (roots) anyway.

## 1. Summary by directory

| Directory | Files | Not reachable from app roots (DEAD) | Reachable only from tests |
|---|---|---|---|
| components | 247 | 10 | 0 |
| lib | 182 | 5 | 0 |
| hooks | 6 | 0 | 0 |
| contexts | 2 | 0 | 0 |
| services | 2 | 2 | 0 |
| packages | 5 | 1 | 0 |
| app (non-convention files) | 866 | 44 | 2 |
| **total** | 1310 | **62** | **2** |

## 2. Dead files (62) - never imported (directly or transitively) by any route, layout, handler or script

| # | File | Dir | Note |
|---|---|---|---|
| 1 | app/attendance/ai-stack/_screens/attendance-models-screen.tsx | app |  |
| 2 | app/career-awareness/_lib/constants.ts | app | its /images/career-awareness/Frame 375*.png assets are therefore also unused |
| 3 | app/course-master/[courseId]/chapters/_coherence-map/CoherenceNodes.tsx | app |  |
| 4 | app/course-master/data/authoring.ts | app |  |
| 5 | app/course-master/data/keyConcepts.ts | app |  |
| 6 | app/course-master/page.redesign.tmp.tsx | app | *.tmp.tsx redesign scratch file committed next to page.tsx |
| 7 | app/fees/_components/fees-placeholder-screen.tsx | app |  |
| 8 | app/fees/ai-stack/_screens/fees-policies-screen.tsx | app |  |
| 9 | app/fees/help-guide-support/_screens/help-guide-support-screens.tsx | app |  |
| 10 | app/general/onboarding/api.ts | app | old onboarding client (still has direct localStorage userData reads) |
| 11 | app/general/onboarding/OnboardingPage.tsx | app | superseded by app/general/onboarding/_lib/onboarding-api.ts flow; api.ts next to it also dead |
| 12 | app/hostel/_components/HostelGapPage.tsx | app |  |
| 13 | app/hrit/attendance-management/attendance-reports/components/index.ts | app |  |
| 14 | app/hrit/attendance-management/attendance-tracking/components/attendance-filters.tsx | app |  |
| 15 | app/hrit/attendance-management/attendance-tracking/components/attendance-summary-cards.tsx | app |  |
| 16 | app/hrit/attendance-management/attendance-tracking/components/attendance-table-toolbar.tsx | app |  |
| 17 | app/hrit/attendance-management/attendance-tracking/components/index.ts | app | barrel with 9 dead sibling components |
| 18 | app/hrit/attendance-management/attendance-tracking/components/leave-balance-card.tsx | app |  |
| 19 | app/hrit/attendance-management/attendance-tracking/components/leave-balance-modal.tsx | app |  |
| 20 | app/hrit/attendance-management/attendance-tracking/components/monthly-summary-card.tsx | app |  |
| 21 | app/hrit/attendance-management/attendance-tracking/components/recent-attendance-card.tsx | app |  |
| 22 | app/hrit/attendance-management/attendance-tracking/components/today-status-card.tsx | app |  |
| 23 | app/hrit/attendance-management/attendance-tracking/components/today-summary-card.tsx | app |  |
| 24 | app/hrit/attendance-management/attendance-tracking/components/upcoming-events-card.tsx | app |  |
| 25 | app/hrit/leave-management/leave-dashboard/components/index.ts | app |  |
| 26 | app/hrit/leave-management/leave-dashboard/components/UpcomingLeaveCard.tsx | app |  |
| 27 | app/organization-management/compliance-library/components/compliance-library-management-types.ts | app |  |
| 28 | app/organization-management/employee-directory/components/shared.tsx | app |  |
| 29 | app/pal/_components/DiagnosticPanel.tsx | app |  |
| 30 | app/students/student_documents/components/DocumentCharts.tsx | app |  |
| 31 | app/students/student_documents/components/MetricsCards.tsx | app |  |
| 32 | app/students/student_documents/components/StudentDocumentCard.tsx | app |  |
| 33 | app/students/student_documents/components/StudentTable.tsx | app |  |
| 34 | app/talent-management/_lib/use-mobility.ts | app |  |
| 35 | app/talent-management/recruitment/components/index.ts | app |  |
| 36 | app/task-management/_components/task-approvals-view.tsx | app |  |
| 37 | app/task-management/_components/task-details-drawer.tsx | app |  |
| 38 | app/task-management/_components/task-workload-view.tsx | app |  |
| 39 | app/task-management/dashboard/components/index.ts | app |  |
| 40 | app/task-management/my-tasks/components/index.ts | app |  |
| 41 | app/task-management/my-tasks/components/task-board-view.tsx | app |  |
| 42 | app/task-management/my-tasks/components/task-list-view.tsx | app |  |
| 43 | app/task-management/my-tasks/components/task-visuals.ts | app |  |
| 44 | app/teach-learn/_lib/teach-learn-menu-categories-api.ts | app |  |
| 45 | components/domain/organization/department-management/department-delete-merge-dialog.tsx | components |  |
| 46 | components/domain/organization/department-management/department-pickers.tsx | components |  |
| 47 | components/domain/organization/department-management/select-input.tsx | components |  |
| 48 | components/intelligence/AiInsightsPanel.tsx | components |  |
| 49 | components/intelligence/EvidenceList.tsx | components |  |
| 50 | components/intelligence/ExplanationCard.tsx | components |  |
| 51 | components/intelligence/GeneratedContentBadge.tsx | components |  |
| 52 | components/intelligence/OutcomeTimeline.tsx | components |  |
| 53 | components/intelligence/RecommendationCard.tsx | components |  |
| 54 | components/templates/DocumentFrame.tsx | components |  |
| 55 | lib/gtg-org-data.ts | lib | static data never imported |
| 56 | lib/gtg-roles.ts | lib | static data never imported |
| 57 | lib/intelligence/admission-document.ts | lib |  |
| 58 | lib/intelligence/template-engine.ts | lib |  |
| 59 | lib/laravel-context.ts | lib | wrapper of buildSessionContext with an unused user parameter |
| 60 | packages/conversational-ai-core/src/file-store.ts | packages | file-backed store; not wired |
| 61 | services/g2g-lms.ts | services | service layer never imported |
| 62 | services/organization.ts | services | service layer never imported |

### 2b. Reachable only from tests (2)

- app/modules/_lib/module-menu-categories-api.ts (imported only by lib/brain/*.test.ts)
- app/modules/_lib/module-routes.ts (imported only by lib/brain/*.test.ts)

## 3. Exported symbols with no importer anywhere (in production-reachable files)

Total 1723 exports in 482 files. By kind: function 254, type 1151, default 13, const 177, named 111, class 17. Caveat: an export used only inside its own file, and exports of Next convention files, are counted here as "no external importer" - they are over-exported rather than necessarily dead. Namespace imports (import * as x) and export * from are treated as using all names, so this is a lower bound.

### 3a. Top 40 files by number of un-imported exports

| # | File | Un-imported exports | Sample |
|---|---|---|---|
| 1 | app/course-master/data/chapters.ts | 34 | ChapterTopic, ChapterConcept, ConceptIntelAbility, ConceptIntelSkill, ConceptIntelKnowledge, ConceptIntelCompetency |
| 2 | lib/intelligence/client.ts | 27 | interpretQuestion, listIntents, getConversation, listSignals, listCases, getCaseEvidence |
| 3 | app/pal/data/pal.ts | 26 | PalReportApiRow, PalReportResult, PalStudentDetails, PalContentMapping, PedagogyRecommendation, PalStudentProfile |
| 4 | lib/intelligence/ai-module.ts | 25 | AiModuleIdentity, AiModuleTurnDetail, AiModuleConversations, AiModuleRate, AiModuleGeneration, AiModuleReports |
| 5 | app/pal/data/pal-eso.ts | 23 | NodeType, EsoLearningSource, QuestionOption, DiagnosticNodeResult, DecisionLogEntry, DiagnosticGroupKey |
| 6 | app/pal/new/data/gamification.ts | 23 | MasteryTierKey, MasteryTier, ConceptRecord, MasterySection, PersonalBestRecord, PersonalBestGroup |
| 7 | app/h5p/data/h5p.ts | 22 | SessionParams, McqIndexPayload, AiScenarioPoint, AiScenarioResult, H5pHubModule, fetchHubModules |
| 8 | app/pal/data/pal-v4.ts | 21 | V4Misconception, V4Competency, V4ClusterSource, V4RemediationItem, V4UluListItem, V4UluListResponse |
| 9 | lib/brain/api.ts | 20 | BrainSession, BrainApiError, getBrainSession, getBrainTenantId, BrainPanel, BrainBreakdown |
| 10 | app/capability-intelligence/_lib/libraries-taxonomy-api.ts | 19 | SessionContext, ApiError, LibraryApiResponse, LibraryListResponse, KASA_TABS, KasaTabId |
| 11 | app/hrit/_lib/attendance-api.ts | 19 | AttendanceRecord, ComplianceItem, AttendanceWeeklyPunch, AttendanceWeeklyParams, MyAttendanceResponse, AttendanceReportIndexResponse |
| 12 | app/talent-management/_lib/talent-types.ts | 19 | RatingBand, TimelineMilestone, ReviewEmployee, ReviewStep, ReviewHistoryItem, CalibrationParticipant |
| 13 | app/h5p/data/h5p-model.ts | 18 | CoverageMatrix, EngagementSignal, TelemetrySummary, H5pPedagogyLink, H5pNodeModel, InventoryRow |
| 14 | app/pal/data/pal-feedback.ts | 18 | FeedbackVerdict, FeedbackTone, FeedbackField, FeedbackEvidence, FeedbackPoint, BandStatus |
| 15 | app/capability-intelligence/_lib/competency-extras-api.ts | 16 | SessionContext, ApiError, MappedJobRole, ProficiencyLevelRow, DetailRow, KasaUsageSkill |
| 16 | app/hrit/_lib/payroll-api.ts | 16 | SessionContext, PayrollTypeListResponse, PayrollStatusResponse, LaravelDepartment, DepartmentsManagementResponse, SalaryStructureResponse |
| 17 | lib/h5p/question-bank-h5p-map.ts | 16 | BankOption, Convertibility, FlashcardSides, BlanksPassage, MatchPair, SingleChoiceOptionPayload |
| 18 | app/pal/data/pal-diagnostic.ts | 15 | DifficultyBand, DiagnosticOption, DiagnosticBandBreakdown, DiagnosticReviewOption, AdaptiveAnswerOutcome, PracticeNextAction |
| 19 | app/pal/data/pal-intervention.ts | 15 | REMEDIATION_CYCLES_BEFORE_ESCALATION, FAILED_CHECKS_BEFORE_ESCALATION, FLAT_LADDER_PROGRESS_PCT, InterventionTriggerKind, InterventionSeverity, InterventionTrigger |
| 20 | app/talent-management/_lib/onboarding-api.ts | 15 | SessionContext, OnbResponse, OnbListResponse, OnbSummaryListResponse, WorkstreamKey, StageKey |
| 21 | components/domain/lms/course-builder/ai-course-service.ts | 15 | buildSessionContext, SessionContext, AiApiResponse, AiProviderStatus, AiSlide, AiOutline |
| 22 | lib/h5p/question-bank-runtime.ts | 15 | RuntimeSingleChoiceOption, RuntimeSingleChoiceQuestion, RuntimeSingleChoiceSet, RuntimeTrueFalseQuestion, RuntimeTrueFalse, RuntimeTextActivityBlank |
| 23 | app/lms/exam/_question-paper-templates/types.ts | 14 | NumberingStyle, SubNumberingStyle, InstructionNumbering, SectionLayout, AnswerSpaceMode, BlueprintHeader |
| 24 | app/pal/new/data/content-model.ts | 14 | BloomLevelDef, VariantBlueprintSlot, TypeCoverage, ChapterList, RequirementScore, ContentNodeType |
| 25 | components/domain/lms/delivery/learning-service.ts | 14 | LearningApiResponse, LearningEnrollment, CompleteCourseResult, SaveProgressPayload, SaveProgressResult, LearningAttempt |
| 26 | app/capability-intelligence/_lib/competency-library-api.ts | 13 | SessionContext, ApiError, CompetencyLibraryApiResponse, CompetencyLibraryListResponse, CompetencyKasbaItem, CompetencyKasbaItemInput |
| 27 | app/talent-management/_lib/development-career-api.ts | 13 | SessionContext, ApiError, DevCareerApiResponse, DevCareerListResponse, PlanStatus, PlanMilestone |
| 28 | components/domain/lms/dashboard/dashboard-service.ts | 13 | LmsApiResponse, EnrollmentStatus, AvailableCoursesFilters, EnrollPayload, EnrollmentUpdatePayload, EnrollmentMutationResponse |
| 29 | app/capability-intelligence/_lib/framework-studio-api.ts | 12 | SessionContext, ApiError, StudioApiResponse, StudioPagination, StudioListResponse, StudioMappingSummary |
| 30 | app/lms/curriculum-planning/types.ts | 12 | SubjectProgressTopic, ApiStats, ApiSubjectMonth, ApiSubject, ApiUpcomingLesson, ApiSubjectProgressTopic |
| 31 | app/talent-management/_lib/offboarding-api.ts | 12 | OffbResponse, OffbPagination, OffbListResponse, ClearanceTask, DocumentItem, CaseComment |
| 32 | lib/platform/types.ts | 12 | ComponentKey, ItemKey, RegistryChannel, ChannelSetting, NotificationChannelRow, NotificationSummary |
| 33 | app/course-master/[courseId]/chapters/_coherence-map/focusLayout.ts | 11 | FOCUS_CARD, FOCUS_EXPANDED, COLUMN_STEP, ROW_STEP, DETAIL_SHIFT, FocusEdgeGeometry |
| 34 | app/fees/_lib/fees-report-utils.ts | 11 | ExportColumn, ExportRow, createEmptyPagination, buildReportUrl, fetchReportIndex, fetchReportGet |
| 35 | components/domain/lms/course-builder/course-builder-service.ts | 11 | SessionContext, BuilderApiResponse, BuilderContent, QuestionOptionDraft, PaperQuestionsResponse, GenerateQuestionsResult |
| 36 | lib/result/masters.ts | 11 | hpcActivity, hpcSkillset, examCreation, stdGradeMapping, resultMaster, resultBookMaster |
| 37 | app/capability-intelligence/_lib/command-center-api.ts | 10 | SessionContext, ApiError, CompetencyApiResponse, CommandCenterSummaryTile, CommandCenterProgressRing, CommandCenterWorkQueue |
| 38 | lib/fees/fees-ai-stack.ts | 10 | FEES_MODULE, FeesCapability, FeesOperationSpec, FeesAiStackSnapshot, resolveFeesAiStack, refreshFeesAiStack |
| 39 | app/hrit/_lib/leave-api.ts | 9 | SessionContext, LeaveApiResponse, LeaveEmployeeOption, LeaveTypeOption, LeaveRequestComment, LeaveRequestTimelineEntry |
| 40 | app/lms/homework/api.ts | 9 | AiEvaluationStatus, HomeworkFilters, SubmissionReportFilters, HomeworkSubmissionFile, HomeworkDetailInfo, HomeworkSourceType |

### 3b. All files (count only)

| File | Un-imported exports |
|---|---|
| app/course-master/data/chapters.ts | 34 |
| lib/intelligence/client.ts | 27 |
| app/pal/data/pal.ts | 26 |
| lib/intelligence/ai-module.ts | 25 |
| app/pal/data/pal-eso.ts | 23 |
| app/pal/new/data/gamification.ts | 23 |
| app/h5p/data/h5p.ts | 22 |
| app/pal/data/pal-v4.ts | 21 |
| lib/brain/api.ts | 20 |
| app/capability-intelligence/_lib/libraries-taxonomy-api.ts | 19 |
| app/hrit/_lib/attendance-api.ts | 19 |
| app/talent-management/_lib/talent-types.ts | 19 |
| app/h5p/data/h5p-model.ts | 18 |
| app/pal/data/pal-feedback.ts | 18 |
| app/capability-intelligence/_lib/competency-extras-api.ts | 16 |
| app/hrit/_lib/payroll-api.ts | 16 |
| lib/h5p/question-bank-h5p-map.ts | 16 |
| app/pal/data/pal-diagnostic.ts | 15 |
| app/pal/data/pal-intervention.ts | 15 |
| app/talent-management/_lib/onboarding-api.ts | 15 |
| components/domain/lms/course-builder/ai-course-service.ts | 15 |
| lib/h5p/question-bank-runtime.ts | 15 |
| app/lms/exam/_question-paper-templates/types.ts | 14 |
| app/pal/new/data/content-model.ts | 14 |
| components/domain/lms/delivery/learning-service.ts | 14 |
| app/capability-intelligence/_lib/competency-library-api.ts | 13 |
| app/talent-management/_lib/development-career-api.ts | 13 |
| components/domain/lms/dashboard/dashboard-service.ts | 13 |
| app/capability-intelligence/_lib/framework-studio-api.ts | 12 |
| app/lms/curriculum-planning/types.ts | 12 |
| app/talent-management/_lib/offboarding-api.ts | 12 |
| lib/platform/types.ts | 12 |
| app/course-master/[courseId]/chapters/_coherence-map/focusLayout.ts | 11 |
| app/fees/_lib/fees-report-utils.ts | 11 |
| components/domain/lms/course-builder/course-builder-service.ts | 11 |
| lib/result/masters.ts | 11 |
| app/capability-intelligence/_lib/command-center-api.ts | 10 |
| lib/fees/fees-ai-stack.ts | 10 |
| app/hrit/_lib/leave-api.ts | 9 |
| app/lms/homework/api.ts | 9 |
| app/pal/new/data/administration.ts | 9 |
| lib/admissions/admissions-ai-stack.ts | 9 |
| lib/attendance/attendance-ai-stack.ts | 9 |
| lib/students/students-ai-stack.ts | 9 |
| app/career-intelligence/_lib/types.ts | 8 |
| app/course-master/data/coherenceMap.ts | 8 |
| app/course-master/data/curriculum.ts | 8 |
| app/course-master/data/questionBank.ts | 8 |
| app/h5p/data/h5p-content-types.ts | 8 |
| app/organization-management/_lib/compliance-library-api.ts | 8 |
| app/pal/data/pal-content.ts | 8 |
| app/talent-management/_lib/certifications-api.ts | 8 |
| app/task-management/_lib/task-session.ts | 8 |
| app/task-management/_lib/task-types.ts | 8 |
| components/domain/lms/catalog/catalog-service.ts | 8 |
| components/intelligence/module/payload.ts | 8 |
| components/ui/coming-soon.tsx | 8 |
| components/ui/select.tsx | 8 |
| app/lms/data/lmsDashboard.ts | 7 |
| app/lms/exam/_result-dashboard/api.ts | 7 |
| app/organization-management/_lib/employee-directory-api.ts | 7 |
| app/students/requests/api.ts | 7 |
| components/domain/lms/assignments/assignments-service.ts | 7 |
| components/intelligence/module/contract.ts | 7 |
| components/ui/dropdown-menu.tsx | 7 |
| components/ui/g2g/dropdown-menu.tsx | 7 |
| lib/intelligence/types.ts | 7 |
| lib/module-ai/module-ai-stack.ts | 7 |
| app/exam/data/onlineExam.ts | 6 |
| app/general/mobile_page_builder/api.ts | 6 |
| app/hrit/_lib/use-leave.ts | 6 |
| app/lms/_shared/question-paper-grid.tsx | 6 |
| app/lms/lmsAnnotate_assignment/api.ts | 6 |
| app/pal/_components/JourneyRail.tsx | 6 |
| app/pal/new/data/coherence-map.ts | 6 |
| components/mobile-page-builder/shared/layoutTypes.ts | 6 |
| lib/intelligence/ai-policies.ts | 6 |
| app/Utility/rollover/api.ts | 5 |
| app/course-master/[courseId]/chapters/_coherence-map/graphLayout.ts | 5 |
| app/easy_com/_lib/types.ts | 5 |
| app/exam/data/aiPaper.ts | 5 |
| app/general/onboarding/_lib/onboarding-api.ts | 5 |
| app/hrit/_lib/hrit-utils.ts | 5 |
| app/organization-management/_lib/role-permissions-api.ts | 5 |
| app/organization-management/compliance-library/components/compliance-library-management-shared.tsx | 5 |
| app/pal/data/pedagogy-engine.ts | 5 |
| app/talent-management/_lib/administration-api.ts | 5 |
| app/talent-management/_lib/employee-profiles-api.ts | 5 |
| app/talent-management/_lib/performance-api.ts | 5 |
| app/talent-management/_lib/use-certifications.ts | 5 |
| app/talent-management/performance-reviews-and-appraisals/components/performance-tabs.tsx | 5 |
| app/task-management/_lib/administration-api.ts | 5 |
| components/domain/lms/certifications-records/certifications-records-service.ts | 5 |
| components/domain/lms/course-builder/use-course-builder.ts | 5 |
| components/domain/lms/sessions-calendar/sessions-calendar-service.ts | 5 |
| lib/ai/project-resolver.ts | 5 |
| lib/intelligence/ai-capabilities.ts | 5 |
| lib/intelligence/ai-templates.ts | 5 |
| lib/platform/cron.ts | 5 |
| app/admissions/_lib/admissions-dashboard-api.ts | 4 |
| app/admissions/admission_registration/workflow.ts | 4 |
| app/capability-intelligence/_lib/use-libraries-taxonomy.ts | 4 |
| app/fees/_lib/fees-dashboard-api.ts | 4 |
| app/general/add_process/_lib/task-publisher.ts | 4 |
| app/h5p/components/game.tsx | 4 |
| app/hostel/api.ts | 4 |
| app/hrit/_lib/leave-mappers.ts | 4 |
| app/lms/_shared/assign-work-panel.tsx | 4 |
| app/lms/data/studentAnalysis.ts | 4 |
| app/lms/exam/_assessment-blueprint/types.ts | 4 |
| app/organization_managment/_lib/department-management-api.ts | 4 |
| app/students/_lib/students-dashboard-api.ts | 4 |
| app/talent-management/recruitment/components/recruitment-data.ts | 4 |
| app/task-management/_components/task-shared.tsx | 4 |
| app/task-management/_lib/projects-api.ts | 4 |
| lib/agents/registry.ts | 4 |
| lib/ai/adapters/shared-utils.ts | 4 |
| lib/intelligence/ai-configuration.ts | 4 |
| lib/intelligence/workspace.ts | 4 |
| lib/pal/practice-answers.ts | 4 |
| lib/question-paper/numbering.ts | 4 |
| lib/result/types.ts | 4 |
| lib/roadmap/index.ts | 4 |
| app/Transportation/_lib/transportation-dashboard-api.ts | 3 |
| app/Transportation/api.ts | 3 |
| app/Utility/breakoff-rollover/api.ts | 3 |
| app/academic_setup/_components/AcademicSetupPage.tsx | 3 |
| app/attendance/_lib/attendance-api.ts | 3 |
| app/career-explorer/_lib/api.ts | 3 |
| app/career-explorer/_lib/types.ts | 3 |
| app/career-intelligence/_lib/api.ts | 3 |
| app/career-intelligence/_lib/evidence.ts | 3 |
| app/classteacher/api.ts | 3 |
| app/components/questionBank/QuestionBankFilterBar.tsx | 3 |
| app/course-master/data/conceptCounts.ts | 3 |
| app/course-master/data/conceptIntelligenceTabLabels.ts | 3 |
| app/course-master/data/courses.ts | 3 |
| app/course-master/data/lmsCourses.ts | 3 |
| app/course-master/data/semanticIntelligence.ts | 3 |
| app/exam/data/progressReport.ts | 3 |
| app/fees/_components/fees-charts.tsx | 3 |
| app/general/add_process/api.ts | 3 |
| app/general/mobile_app_rights/api.ts | 3 |
| app/h5p/components/content-type-list.tsx | 3 |
| app/h5p/data/question-bank-library.ts | 3 |
| app/hooks/usePermission.ts | 3 |
| app/hostel/_lib/hostel-dashboard-api.ts | 3 |
| app/inward_outward/_lib/api.ts | 3 |
| app/lib/routes.ts | 3 |
| app/library/_lib/library-dashboard-api.ts | 3 |
| app/lms/data/questionWiseReport.ts | 3 |
| app/lms/data/socialCollaborative.ts | 3 |
| app/lms/exam/_question-paper-templates/resolve.ts | 3 |
| app/organization-management/_lib/disciplinary-library-api.ts | 3 |
| app/organization_managment/Department/Component/rules.tsx | 3 |
| app/organization_managment/Department/Component/sops.tsx | 3 |
| app/pal/_components/BandMeter.tsx | 3 |
| app/pal/data/pal-content-model.ts | 3 |
| app/pal/new/gamification/_components/GamificationChrome.tsx | 3 |
| app/platform-services/_components/shell.tsx | 3 |
| app/student/report/_lib/student-report.ts | 3 |
| app/talent-management/onboarding/components/onboarding-shared.tsx | 3 |
| app/talent-management/onboarding/components/onboarding-sheets.tsx | 3 |
| app/task-management/_lib/calendar-api.ts | 3 |
| app/task-management/_lib/my-tasks-api.ts | 3 |
| components/document-template/merge.ts | 3 |
| components/intelligence/module/registry.ts | 3 |
| components/ui/alert-dialog.tsx | 3 |
| components/ui/avatar.tsx | 3 |
| components/ui/dialog.tsx | 3 |
| components/ui/popover.tsx | 3 |
| components/ui/sheet.tsx | 3 |
| lib/agents/executors.ts | 3 |
| lib/agents/store.ts | 3 |
| lib/agents/types.ts | 3 |
| lib/ai/conversational-admin/service-token.ts | 3 |
| lib/ai/field-edit/types.ts | 3 |
| lib/h5p/drag-gesture.ts | 3 |
| lib/h5p/memory-game.ts | 3 |
| lib/h5p/single-choice-set.ts | 3 |
| lib/result/api.ts | 3 |
| app/Transportation/_components/transportation-dashboard.tsx | 2 |
| app/Utility/student-transfer/api.ts | 2 |
| app/Utility/update-all-data/api.ts | 2 |
| app/_lib/use-module-level3-nav.ts | 2 |
| app/admin-services/_lib/complaint.ts | 2 |
| app/admin-services/_lib/consent.ts | 2 |
| app/admin-services/_lib/frontdesk.ts | 2 |
| app/admin-services/_lib/visitor.ts | 2 |
| app/admissions/_components/admissions-dashboard.tsx | 2 |
| app/admissions/admission_enquiry/followUpApi.ts | 2 |
| app/capability-intelligence/_lib/use-competency-library.ts | 2 |
| app/capability-intelligence/_lib/use-framework-studio.ts | 2 |
| app/course-master/[courseId]/chapters/ContentCard.tsx | 2 |
| app/course-master/[courseId]/chapters/GenerationPipeline.tsx | 2 |
| app/course-master/[courseId]/chapters/_coherence-map/LaneEdge.tsx | 2 |
| app/course-master/data/chapterTopics.ts | 2 |
| app/dashboard/_lib/dashboard-api.ts | 2 |
| app/data/menuItems.ts | 2 |
| app/document-templates/api.ts | 2 |
| app/documents/_lib/documents-api.ts | 2 |
| app/enterprise-brain/_components/IntelligenceCard.tsx | 2 |
| app/fees/_components/fees-dashboard.tsx | 2 |
| app/fees/_lib/fees-api.ts | 2 |
| app/fees/_lib/fees-verification.ts | 2 |
| app/front_desk/create-timetable/api.ts | 2 |
| app/general/form_builder/FormBuilderEditor.tsx | 2 |
| app/h5p/h5p_course_presentation/components/editor.tsx | 2 |
| app/h5p/h5p_image_hotspots/components/marker.tsx | 2 |
| app/hostel/_components/hostel-dashboard.tsx | 2 |
| app/hostel/setup-api.ts | 2 |
| app/hrit/_lib/hrit-types.ts | 2 |
| app/hrit/_lib/use-form16.ts | 2 |
| app/hrit/_lib/use-payroll-deduction.ts | 2 |
| app/hrit/leave-management/leave-reports/components/LeaveReportsSections.tsx | 2 |
| app/library/_components/library-dashboard.tsx | 2 |
| app/lms/_shared/submission-status.ts | 2 |
| app/lms/curriculum-planning/dialogs.tsx | 2 |
| app/lms/data/activityStream.ts | 2 |
| app/lms/data/leaderBoard.ts | 2 |
| app/lms/exam/_assessment-blueprint/BlueprintEditor.tsx | 2 |
| app/lms/exam/_exam-evaluation/types.ts | 2 |
| app/organization-management/_lib/role-permissions-tree.ts | 2 |
| app/organization_managment/Department/Component/department-edit-dialog.tsx | 2 |
| app/organization_managment/Department/Component/polices.tsx | 2 |
| app/pal/_components/CompletionState.tsx | 2 |
| app/pal/_components/NextStepCard.tsx | 2 |
| app/pal/data/pal-completion.ts | 2 |
| app/pal/new/gamification/_components/GamificationScope.tsx | 2 |
| app/people-competency/lms/assignments/_lib/use-assignments.ts | 2 |
| app/student/_components/StudentCareModule.tsx | 2 |
| app/student/bulk_student_update/api.ts | 2 |
| app/students/_components/students-dashboard.tsx | 2 |
| app/talent-management/_lib/use-development-career.ts | 2 |
| app/talent-management/_lib/use-performance.ts | 2 |
| app/talent-management/_lib/use-talent-dashboard.ts | 2 |
| components/document-template/editor/hooks/useOverlayTransform.ts | 2 |
| components/document-template/editor/ui.tsx | 2 |
| components/domain/lms/assessments/assessment-paper.tsx | 2 |
| components/domain/lms/catalog/use-course-catalog.ts | 2 |
| components/domain/lms/certifications-records/use-lms-certifications.ts | 2 |
| components/domain/lms/dashboard/use-lms-dashboard.ts | 2 |
| components/domain/lms/dashboard/widgets/shared.tsx | 2 |
| components/domain/lms/lib/greeting.ts | 2 |
| components/intelligence/conceptIntelligenceGuide.ts | 2 |
| components/ui/alert.tsx | 2 |
| components/ui/g2g/badge.tsx | 2 |
| components/ui/g2g/button.tsx | 2 |
| components/ui/g2g/input.tsx | 2 |
| components/ui/g2g/table.tsx | 2 |
| components/ui/g2g/textarea.tsx | 2 |
| components/ui/status-badge.tsx | 2 |
| contexts/PageAiContext.tsx | 2 |
| hooks/use-sidebar-navigation.ts | 2 |
| lib/agents/acting-user.ts | 2 |
| lib/ai/field-edit/prompt.ts | 2 |
| lib/app-version.ts | 2 |
| lib/brain/navigation.ts | 2 |
| lib/certificate/certificate-ai-stack.ts | 2 |
| lib/chatbot-storage.ts | 2 |
| lib/circulars/circulars-ai-stack.ts | 2 |
| lib/communication/communication-ai-stack.ts | 2 |
| lib/complaint/complaint-ai-stack.ts | 2 |
| lib/consent/consent-ai-stack.ts | 2 |
| lib/curriculum-planning/curriculum-planning-ai-stack.ts | 2 |
| lib/document-templates/document-templates-ai-stack.ts | 2 |
| lib/engagement/engagement-ai-stack.ts | 2 |
| lib/exam-assessment/exam-assessment-ai-stack.ts | 2 |
| lib/exam/exam-ai-stack.ts | 2 |
| lib/front-desk/front-desk-ai-stack.ts | 2 |
| lib/h5p/course-presentation-scoring.ts | 2 |
| lib/h5p/drag-drop-scoring.ts | 2 |
| lib/h5p/image-hotspots.ts | 2 |
| lib/h5p/true-false.ts | 2 |
| lib/hostel/hostel-ai-stack.ts | 2 |
| lib/institute/institute-ai-stack.ts | 2 |
| lib/interactions/interactions-ai-stack.ts | 2 |
| lib/inventory/inventory-ai-stack.ts | 2 |
| lib/inward/inward-ai-stack.ts | 2 |
| lib/library/library-ai-stack.ts | 2 |
| lib/lms-ai/lms-ai-stack.ts | 2 |
| lib/mobile-apps/mobile-apps-ai-stack.ts | 2 |
| lib/new-pal/new-pal-ai-stack.ts | 2 |
| lib/pal/eso-answers.ts | 2 |
| lib/pal/exam-answers.ts | 2 |
| lib/parent-communication/parent-communication-ai-stack.ts | 2 |
| lib/petty-cash/petty-cash-ai-stack.ts | 2 |
| lib/ptm/ptm-ai-stack.ts | 2 |
| lib/question-paper/sections.ts | 2 |
| lib/session/internal-access.ts | 2 |
| lib/sqaa/sqaa-ai-stack.ts | 2 |
| lib/student-icard/student-icard-ai-stack.ts | 2 |
| lib/student-medical/student-medical-ai-stack.ts | 2 |
| lib/student-requests/student-requests-ai-stack.ts | 2 |
| lib/task-management/task-management-ai-stack.ts | 2 |
| lib/teach-learn/teach-learn-ai-stack.ts | 2 |
| lib/timetable/timetable-ai-stack.ts | 2 |
| lib/transport/transport-ai-stack.ts | 2 |
| lib/user-icard/user-icard-ai-stack.ts | 2 |
| lib/users/users-ai-stack.ts | 2 |
| lib/utility/utility-ai-stack.ts | 2 |
| lib/visitor/visitor-ai-stack.ts | 2 |
| packages/ai-intelligence-core/src/index.ts | 2 |
| app/Inventory/api.ts | 1 |
| app/Transportation/_components/TransportationPage.tsx | 1 |
| app/Utility/custom-module/api.ts | 1 |
| app/_components/ai-stack/models-screen.tsx | 1 |
| app/_lib/module-screen-registry.tsx | 1 |
| app/admin-services/_lib/pettyCash.ts | 1 |
| app/admin-services/_lib/ptm.ts | 1 |
| app/admissions/admission_followUp/_lib/follow-up-agenda-api.ts | 1 |
| app/admissions/admission_form/_lib/admission-form-api.ts | 1 |
| app/admissions/admission_registration/types.ts | 1 |
| app/ai/_components/ModulePicker.tsx | 1 |
| app/attendance/attendance_dashboard/components/MetricCard.tsx | 1 |
| app/capability-intelligence/_lib/use-command-center.ts | 1 |
| app/capability-intelligence/_lib/use-competency-extras.ts | 1 |
| app/career-awareness/_components/CareerAwarenessSectionHub.tsx | 1 |
| app/components/questionBank/RichText.tsx | 1 |
| app/components/utils/api_url.tsx | 1 |
| app/course-master/[courseId]/chapters/_coherence-map/ConceptCard.tsx | 1 |
| app/course-master/[courseId]/chapters/_coherence-map/FocusBreadcrumb.tsx | 1 |
| app/data/menuMappers.ts | 1 |
| app/data/menuSearch.ts | 1 |
| app/data/moduleDashboards.ts | 1 |
| app/data/routeMapper.ts | 1 |
| app/documents/_components/document-source-table.tsx | 1 |
| app/documents/_components/documents-dashboard.tsx | 1 |
| app/easy_com/_lib/api.ts | 1 |
| app/enterprise-brain/_components/charts.tsx | 1 |
| app/enterprise-brain/_components/primitives.tsx | 1 |
| app/fees/_components/fees-report-shared.tsx | 1 |
| app/fees/_lib/fees-screen-registry.tsx | 1 |
| app/fees/ai-stack/_screens/fees-automations-screen.tsx | 1 |
| app/fees/intelligence/_components/fees-intelligence-primitives.tsx | 1 |
| app/front_desk/_lib/modules.ts | 1 |
| app/general/_components/GeneralPage.tsx | 1 |
| app/general/add_process/_components/StepWorkflow.tsx | 1 |
| app/general/add_process/_lib/process-store.ts | 1 |
| app/general/configs.ts | 1 |
| app/general/form_builder/types.ts | 1 |
| app/general/groupwise_rights/api.ts | 1 |
| app/general/individual_rights/api.ts | 1 |
| app/general/onboarding/_components/onboarding-ui.tsx | 1 |
| app/general/onboarding/_lib/module-launch.ts | 1 |
| app/h5p/components/content-type-form.tsx | 1 |
| app/h5p/components/fields.tsx | 1 |
| app/h5p/components/question-bank-source.tsx | 1 |
| app/h5p/components/shared.tsx | 1 |
| app/h5p/data/question-bank-source.ts | 1 |
| app/h5p/h5p_drag_drop/components/use-drag-gesture.ts | 1 |
| app/h5p/h5p_image_hotspots/components/editor.tsx | 1 |
| app/h5p/question-bank-library/components/library-filters.tsx | 1 |
| app/h5p/question-bank-library/components/question-rows.tsx | 1 |
| app/h5p/question-bank-library/components/quiz-runner.tsx | 1 |
| app/h5p/question-bank-library/debug.ts | 1 |
| app/hooks/useMenuRights.ts | 1 |
| app/hostel/configs.ts | 1 |
| app/hrit/_components/kpi-card.tsx | 1 |
| app/hrit/_lib/attendance-regularization-api.ts | 1 |
| app/hrit/_lib/use-monthly-payroll.ts | 1 |
| app/hrit/_lib/use-payroll.ts | 1 |
| app/hrit/_lib/use-salary-structure.ts | 1 |
| app/hrit/attendance-management/_shared/attendance-donut-chart.tsx | 1 |
| app/hrit/attendance-management/_shared/attendance-highlights.tsx | 1 |
| app/hrit/attendance-management/_shared/attendance-tabs.tsx | 1 |
| app/hrit/attendance-management/_shared/attendance-trend-chart.tsx | 1 |
| app/hrit/attendance-management/_shared/enhanced-attendance-filters.tsx | 1 |
| app/hrit/attendance-management/attendance-tracking/components/attendance-drill-down-drawer.tsx | 1 |
| app/hrit/attendance-management/attendance-tracking/components/widgets/widget-types.ts | 1 |
| app/lms/_shared/StudentScopeToggle.tsx | 1 |
| app/lms/book-list/api.ts | 1 |
| app/lms/curriculum-planning/OverviewTab.tsx | 1 |
| app/lms/curriculum-planning/shared.tsx | 1 |
| app/lms/exam/_assessment-blueprint/AssessmentBlueprints.tsx | 1 |
| app/lms/exam/_assessment-blueprint/pdf.tsx | 1 |
| app/lms/exam/_question-paper-templates/api.ts | 1 |
| app/lms/exam/_question-paper-templates/pdf.tsx | 1 |
| app/lms/global-mapping/api.ts | 1 |
| app/lms/leader-board-master/api.ts | 1 |
| app/lms/lmsAssignment_submission/api.ts | 1 |
| app/lms/syllabus-plan/api.ts | 1 |
| app/organization-management/_lib/use-compliance-extras.ts | 1 |
| app/organization-management/_lib/use-compliance-library.ts | 1 |
| app/organization-management/_lib/use-disciplinary-library.ts | 1 |
| app/organization-management/_lib/use-employee-directory.ts | 1 |
| app/organization-management/_lib/use-role-permissions.ts | 1 |
| app/organization_managment/Department/Component/ai-generation-drawer.tsx | 1 |
| app/organization_managment/Department/Component/department-create-wizard.tsx | 1 |
| app/organization_managment/_lib/institute-profile-api.ts | 1 |
| app/pal/_components/DiagnosticNavigator.tsx | 1 |
| app/pal/_components/PalContextBootstrap.tsx | 1 |
| app/pal/_components/PalTaxonomyDetailPage.tsx | 1 |
| app/pal/_components/PalTaxonomyParentPage.tsx | 1 |
| app/pal/_components/PalWorkspace.tsx | 1 |
| app/pal/data/pal-lookups.ts | 1 |
| app/pal/new/_components/AdministrationChrome.tsx | 1 |
| app/pal/new/_components/NewPalNav.tsx | 1 |
| app/pal/new/gamification/_components/useGamificationResource.ts | 1 |
| app/people-competency/lms/sessions-calendar/_lib/use-sessions.ts | 1 |
| app/platform-services/scheduler/_components/SchedulerConsole.tsx | 1 |
| app/platform-services/workflow/_components/WorkflowConsole.tsx | 1 |
| app/quiz/_lib/quiz-api.ts | 1 |
| app/student/_components/mobileValidation.ts | 1 |
| app/students/house/api.ts | 1 |
| app/students/search_student/components/MetricCard.tsx | 1 |
| app/students/search_student/components/StatusBadge.tsx | 1 |
| app/students/search_student/components/StudentProfilesTab.tsx | 1 |
| app/students/search_student/components/TableHeader.tsx | 1 |
| app/talent-management/administration/components/admin-data.ts | 1 |
| app/talent-management/performance-reviews-and-appraisals/components/performance-sidebar.tsx | 1 |
| app/task-management/_lib/competency-api.ts | 1 |
| app/task-management/_lib/dashboard-api.ts | 1 |
| app/task-management/_lib/integration-types.ts | 1 |
| app/task-management/_lib/reports-api.ts | 1 |
| app/task-management/_lib/use-dependencies.ts | 1 |
| app/teach-learn/_lib/teach-learn-screen-registry.tsx | 1 |
| app/teacher_daily_report/api.ts | 1 |
| components/ai/AiFieldAssistant.tsx | 1 |
| components/document-template/blocks/A4PageBlock.tsx | 1 |
| components/document-template/blocks/ButtonBlock.tsx | 1 |
| components/document-template/blocks/ContainerBlock.tsx | 1 |
| components/document-template/blocks/DividerBlock.tsx | 1 |
| components/document-template/blocks/DocumentContainer.tsx | 1 |
| components/document-template/blocks/DrawingBlock.tsx | 1 |
| components/document-template/blocks/GridBlock.tsx | 1 |
| components/document-template/blocks/ImageBlock.tsx | 1 |
| components/document-template/blocks/LineBlock.tsx | 1 |
| components/document-template/blocks/ShapeBlock.tsx | 1 |
| components/document-template/blocks/TableBlock.tsx | 1 |
| components/document-template/blocks/TextBlock.tsx | 1 |
| components/document-template/editor/Topbar.tsx | 1 |
| components/domain/lms/assessments/load-state.tsx | 1 |
| components/domain/lms/delivery/use-my-learning.ts | 1 |
| components/h5p/players/shared.tsx | 1 |
| components/intelligence/ConceptIntelligenceHelp.tsx | 1 |
| components/intelligence/module/format.ts | 1 |
| components/intelligence/module/primitives.tsx | 1 |
| components/intelligence/module/section-nav.tsx | 1 |
| components/mobile-page-builder/editor/MobileBuilderContext.tsx | 1 |
| components/mobile-page-builder/renderer/MobilePageRenderer.tsx | 1 |
| components/mobile-page-builder/shared/layoutTransform.ts | 1 |
| components/result/DynamicForm.tsx | 1 |
| components/result/PageHeader.tsx | 1 |
| components/result/primitives.tsx | 1 |
| components/ui/badge.tsx | 1 |
| components/ui/calendar.tsx | 1 |
| components/ui/data-table.tsx | 1 |
| components/ui/g2g/card.tsx | 1 |
| components/ui/g2g/data-table.tsx | 1 |
| components/ui/g2g/filter-bar.tsx | 1 |
| components/ui/g2g/searchable-select.tsx | 1 |
| components/ui/g2g/select.tsx | 1 |
| components/ui/progress.tsx | 1 |
| components/ui/spinner.tsx | 1 |
| components/ui/stat-card.tsx | 1 |
| components/ui/table.tsx | 1 |
| hooks/use-ai-workspace.ts | 1 |
| lib/academic-year.ts | 1 |
| lib/agents/client.ts | 1 |
| lib/agents/engine.ts | 1 |
| lib/ai/conversational-admin/client.ts | 1 |
| lib/ai/conversational-admin/service.ts | 1 |
| lib/ai/conversational-admin/store.ts | 1 |
| lib/ai/conversational-admin/types.ts | 1 |
| lib/ai/field-edit/actions.ts | 1 |
| lib/ai/mcp-client.ts | 1 |
| lib/ai/session.ts | 1 |
| lib/date-only.ts | 1 |
| lib/erp-client.ts | 1 |
| lib/h5p/arithmetic-quiz.ts | 1 |
| lib/h5p/drag-drop-canvas.ts | 1 |
| lib/intelligence/ai-generate.ts | 1 |
| lib/intelligence/ask-adapter.ts | 1 |
| lib/intelligence/ask-stream.ts | 1 |
| lib/intelligence/module-handoff.ts | 1 |
| lib/intelligence/ui-messages.ts | 1 |
| lib/pal/diagnostic-answers.ts | 1 |
| lib/question-paper/images.ts | 1 |
| lib/question-paper/question-types.ts | 1 |
| lib/video-embed.ts | 1 |
| packages/conversational-ai-core/src/followup-suggestions.ts | 1 |

## 4. K-12 ERP Design System/** and g2g/**

- **K-12 ERP Design System/** (299 tracked files: 74 .md, 77 .jsx, 71 .ts, 44 .html, 25 .css, 4 .js, 2 .json, 1 .svg, 1 .thumbnail): **imported by nothing** in app/, components/, lib/, hooks/, contexts/, services/ or packages/ (import-graph edges from application code into the folder = 0; the folder's own 152 TS/JS files have 0 edges out of the folder). It is purely committed reference/design-handoff material (SKILL.md + *.prompt.md component specs + UI-kit HTML). BUT tsconfig.json `include` is `**/*.ts, **/*.tsx` with only node_modules excluded, so its 71 .ts files are type-checked by `npm run typecheck`, and ESLint/Next also see the folder - it should be excluded from tsconfig/eslint or moved out of the repo.
- **g2g/** contains exactly one tracked file, `g2g/globals.css`, which IS used: it is imported by 6 layouts (app/capability-intelligence/layout.tsx:2, app/hrit/layout.tsx:2, app/organization-management/layout.tsx:2, app/people-competency/lms/layout.tsx:2, app/task-management/layout.tsx:2, app/talent-management/layout.tsx:2) via a relative path that leaves app/. It is not reference material. next.config.ts comment says g2g UI lives in components/ui/g2g (true).
- **components/ui vs components/ui/g2g** (two parallel primitive sets, 34 + 14 files): duplicate names and importer counts (importers of the plain / g2g version): badge 48/14, button 381/55, card 162/22, data-table 11/2, dropdown-menu 16/16, input 210/32, radio-group 3/4, select 32/71, table 144/17, textarea 69/14. g2g-only: accordion (2), filter-bar (1), searchable-select (3), time-picker (2). `select` and `radio-group` have flipped majority (g2g is the main one there); every other primitive has two live implementations, so visual behaviour differs by module. No file in components/ui has zero importers.
- Other committed tool noise (per brief): .kilo/ 24, .codex/ 2, .claude/ 1, diff_frontend.txt, .tsc-check2.log, tsconfig.tsbuildinfo + tsconfig.scoped.tsbuildinfo exist in the repo root (untracked build caches), .tsc-check2.log (tracked compiler log), app/student/lms_k12.code-workspace (an IDE workspace file inside a route folder), app/lms/leader-board-master/page.css.

## 5. Unused public/ assets

40 files under public/. Not referenced by any live source string (references from dead files excluded) or CSS: **32**:

- public/file.svg
- public/globe.svg
- public/images/career-awareness/Frame 375 (1).png
- public/images/career-awareness/Frame 375 (2).png
- public/images/career-awareness/Frame 375 (3).png
- public/images/career-awareness/Frame 375 (4).png
- public/images/career-awareness/Frame 375 (5).png
- public/images/career-awareness/Frame 375 (6).png
- public/images/career-awareness/Frame 375 (7).png
- public/images/career-awareness/Frame 375.png
- public/images/career-awareness/amico.png
- public/images/career-awareness/bro.png
- public/images/career-awareness/bro2.png
- public/images/career-awareness/image 9.png
- public/images/career-awareness/pana.png
- public/images/career-awareness/pana2.png
- public/images/career-awareness/pana3.png
- public/images/career-awareness/rafiki.png
- public/images/career-explorer/Frame 375 (1).png
- public/images/career-explorer/Frame 375 (2).png
- public/images/career-explorer/Frame 375 (3).png
- public/images/career-explorer/Frame 375 (4).png
- public/images/career-explorer/Frame 375 (5).png
- public/images/career-explorer/Frame 375 (6).png
- public/images/career-explorer/Frame 375 (7).png
- public/images/career-explorer/Frame 375.png
- public/images/career-explorer/college-campus-fallback.png
- public/images/career-explorer/flag.png
- public/images/career-explorer/location.png
- public/next.svg
- public/vercel.svg
- public/window.svg

The five create-next-app SVGs (file/globe/next/vercel/window) are unused boilerplate; career-awareness amico/bro/bro2/pana/pana2/pana3/rafiki/"image 9" and career-explorer college-campus-fallback/flag/location are referenced by nothing (the Frame 375*.png set is referenced only from the dead app/career-awareness/_lib/constants.ts).

## 6. scripts/ and package.json

| Script file | Referenced by package.json? | Notes |
|---|---|---|
| scripts/generate-module-screens.mts | no npm script | header of app/_lib/module-screens.generated.ts says to run `node --import tsx scripts/generate-module-screens.mts` manually; output committed (538 lines, 517 entries). No CI to regenerate/verify it (.github/workflows empty) - drift risk: 517 registered screens vs 676 pages |
| scripts/check-agent-catalogue.ts | no npm script | manual checker (204 lines) |

package.json scripts: dev, build, start, lint, typecheck (`tsc --noEmit`), test (`node --import tsx --test "lib/**/*.test.ts" "packages/**/*.test.ts"`). All 42 test files live under lib/ (none under packages/, app/ or components/); the glob would not pick up tests elsewhere.
