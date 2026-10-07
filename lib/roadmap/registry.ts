/**
 * The product roadmap registry — one source of truth for every "coming soon"
 * surface in the product.
 *
 * WHY THIS EXISTS
 *
 * Parts of K-12 are genuinely live (Mainstream curriculum, CASEL/SEL alignment,
 * the Fees dashboard, Concept Intelligence). Parts are roadmap. Before this file
 * the roadmap parts were either silently absent — which reads as a gap — or
 * described in five different hand-written "coming soon" styles, which reads as
 * unfinished.
 *
 * Every placeholder in the product now reads its wording from here, and the
 * Platform Roadmap screen is a *view* over this list rather than a second list
 * maintained by hand. That is the whole point: a roadmap page that is assembled
 * from the same rows the placeholders render cannot drift from what the product
 * actually shows a customer.
 *
 * HOW TO CHANGE THE ROADMAP
 *
 * Edit a row here. Do not hard-code roadmap copy into a screen — if a screen
 * needs to say something is coming, it needs a row in this file first.
 *
 * AUDIENCE
 *
 * `audience: 'internal'` keeps a row off the customer-facing roadmap screen
 * while still letting the placeholder render for staff. AI Governance is the
 * live example: showing a customer that we have automated decisions with no
 * approval trail advertises our own gap, so it stays internal until it is built.
 */

/** Where something sits on the plan. `exploring` has no committed phase yet. */
export type RoadmapPhase = 'Phase 2' | 'Phase 3' | 'Exploring';

/**
 * What state the thing is actually in.
 *
 * `live` rows exist so the roadmap screen can show what is already delivered
 * next to what is coming — a roadmap of only unbuilt things undersells the
 * product. `in-progress` is for work that is decided and underway, which is a
 * genuinely different claim from "coming soon".
 */
export type RoadmapStatus = 'live' | 'pilot' | 'in-progress' | 'coming-soon';

/** Who may see this row on the consolidated roadmap screen. */
export type RoadmapAudience = 'customer' | 'internal';

/**
 * Settled names for things that were being called two different things.
 *
 * THE COLLISION
 *
 * "Enrichment" was in use for two unrelated ideas: a per-concept extension
 * activity a student does after mastering something, and a whole tier of
 * subjects (AI literacy, coding, robotics). One word, two meanings, and a
 * developer picking up either without the full context would have built the
 * wrong one.
 *
 * THE RESOLUTION
 *
 * "Enrichment" keeps the per-concept activity meaning. The subject tier is
 * called "Future capabilities". Checked against the code before deciding: every
 * live use of "Enrichment" already means the activity (the lesson-plan
 * "Enrichment activity" field, ESO's enrichment resolver, PAL's content
 * enrichment), and the subject-tier meaning appears nowhere. So this keeps what
 * is already true and renames nothing.
 *
 * "Interactive learning" is the capability name. H5P is one technology inside
 * it, so naming the capability after the file format would be like naming a
 * library after its shelving. "Learning resources" replaces "student
 * resources", because the same resource is used in class, at home and inside
 * PAL — "student" implied one of those three.
 *
 * NOT A RENAME
 *
 * Live LMS navigation is frozen for demo week, and none of these change a
 * screen. This constant exists so new copy is written to the settled names
 * rather than re-opening the argument each time.
 *
 * READ, NOT DECORATIVE
 *
 * The rows below reference these values rather than repeating the strings. A
 * naming decision nothing reads is a comment with extra steps — it drifts the
 * first time someone edits a title without knowing the decision existed.
 * `lib/roadmap/catalog.test.ts` pins the pairing.
 */
export const NAMING = {
  /** A per-concept extension activity. NOT a category of subjects. */
  enrichment: 'Enrichment',
  /** The subject tier: AI literacy, coding, robotics. NOT "Enrichment". */
  futureCapabilities: 'Future capabilities',
  /** The capability. NOT "H5P", which is one technology within it. */
  interactiveLearning: 'Interactive learning',
  /** Consumed in class, at home and in PAL — so not "Student resources". */
  learningResources: 'Learning resources',
} as const;

export interface RoadmapItem {
  /** Stable dotted id. Screens reference this, never the title. */
  id: string;
  /** Groups rows on the roadmap screen. Sentence case, matches product nav. */
  module: string;
  title: string;
  /** One sentence, sentence case, no emoji — per the design system's content rules. */
  blurb: string;
  phase: RoadmapPhase;
  status: RoadmapStatus;
  audience: RoadmapAudience;
  /** Where the placeholder for this row is shown, when it has a home. */
  href?: string;
  /**
   * Frontend files that prove this row's status, relative to the repo root.
   *
   * A status is a claim about the codebase, so the claim carries its proof.
   * `registry-evidence.test.ts` fails when a listed path disappears, and when a
   * Platform services row marked live or in-progress lists none, so a status
   * cannot outlive the code it describes. Backend-only proof goes in a comment
   * beside the row: this repo cannot check another repo's files.
   */
  evidence?: readonly string[];
}

/**
 * How each course-catalog category is presented on the catalog rollup strip.
 *
 * WHY THE COUNTS ARE SPLIT
 *
 * The "active" number is never stored here — it is counted from the subjects the
 * catalog API actually returns, so the counter and the cards under it are read
 * from one source and cannot disagree. Only `planned` lives here, because a
 * planned subject has no row in the database yet by definition: it is a product
 * intention, not tenant data.
 *
 * `category` must match `content_category` from `/api/lms-courses` byte for
 * byte, including the "Vocational Traning" misspelling, which is the real value
 * stored against those rows. `label` is what we show instead.
 */
export interface CatalogCategoryPlan {
  /** Exact `content_category` value as returned by the API. */
  category: string;
  /**
   * Other stored spellings that mean this same tier.
   *
   * `sub_std_map.subject_category` is free text, so one tier reached the
   * database under more than one spelling: `Soft Skill` (singular, 11 subjects)
   * and `My Courses` (plural, 4 subjects) both exist alongside the canonical
   * values. Folded in here because otherwise a school sees two tiles for one
   * tier — a populated "Soft Skill — 11 active" beside an empty
   * "Soft skills — Coming in Phase 2" — which contradicts itself on the same
   * row of the screen.
   */
  aliases?: string[];
  /** Corrected display name, when the stored value should not be shown as-is. */
  label?: string;
  /**
   * Subjects intended but not yet built.
   *
   * Left undefined where the number has not been agreed. The strip then shows
   * the status without a count rather than inventing one — a made-up "18
   * planned" that a customer later counts is worse than no number.
   */
  planned?: number;
  status: RoadmapStatus;
  phase: RoadmapPhase;
}

export const CATALOG_CATEGORY_PLAN: CatalogCategoryPlan[] = [
  // Live today — real content, no roadmap treatment.
  { category: 'My Course', aliases: ['My Courses'], label: 'Mainstream', status: 'live', phase: 'Phase 2' },
  { category: 'SEL', label: 'SEL', status: 'live', phase: 'Phase 2' },

  // Roadmap tiers. `planned` is filled in only where the team has agreed a
  // number; the rest show as "Coming soon" until someone confirms a figure.
  {
    category: 'Vocational Traning',
    label: 'Vocational training',
    planned: 18,
    status: 'coming-soon',
    phase: 'Phase 2',
  },
  // No rows carry this category yet — it is a planned tier, not an existing
  // one, which is precisely why it belongs on the strip. Without it the tier
  // named in the build plan would simply be invisible.
  {
    category: 'Future Capabilities',
    label: NAMING.futureCapabilities,
    status: 'coming-soon',
    phase: 'Phase 3',
  },
  { category: 'STEM Resources', label: 'STEM resources', status: 'coming-soon', phase: 'Phase 2' },
  { category: 'Career Counselling', label: 'Career counselling', status: 'coming-soon', phase: 'Phase 2' },
  {
    category: 'Soft Skills',
    aliases: ['Soft Skill'],
    label: 'Soft skills',
    status: 'coming-soon',
    phase: 'Phase 2',
  },
  { category: 'Foundational Skills', label: 'Foundational skills', status: 'coming-soon', phase: 'Phase 2' },
  { category: 'Sports', label: 'Sports', status: 'coming-soon', phase: 'Phase 3' },
  { category: 'Hobbies and Activities', label: 'Hobbies and activities', status: 'coming-soon', phase: 'Phase 3' },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  // ── Course catalog ────────────────────────────────────────────────────────
  // Category lifecycle counts come from the API, not from here. These rows are
  // the product statement about each catalog tier.
  {
    id: 'course-catalog.vocational',
    module: 'Course catalog',
    title: 'Vocational training',
    blurb: 'Trade and vocational subjects, with the same chapter and assessment structure as mainstream courses.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/course-master',
  },
  {
    id: 'course-catalog.career-exploration',
    module: 'Course catalog',
    title: 'Career exploration',
    blurb: 'Career-awareness subjects that feed a student profile rather than a grade.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/course-master',
  },
  {
    id: 'course-catalog.future-capabilities',
    module: 'Course catalog',
    title: NAMING.futureCapabilities,
    blurb: 'AI literacy, coding and robotics as a subject tier a school can switch on.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
    href: '/course-master',
  },
  {
    id: 'course-catalog.school-enablement',
    module: 'Course catalog',
    title: 'School enablement',
    blurb: 'Each school chooses which categories and subjects it offers, without a separate build.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'course-catalog.grade-enablement',
    module: 'Course catalog',
    title: 'Grade enablement',
    blurb: 'Decide which subjects each grade is offered, not just which the school has switched on.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'course-catalog.student-enablement',
    module: 'Course catalog',
    title: 'Student choice',
    blurb: 'Within what the school offers, a student picks the electives they want to take.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'course-catalog.learning-model',
    module: 'Course catalog',
    title: 'School learning models',
    blurb: 'Preset bundles — STEM and innovation, communication and leadership, career and vocational — that configure a school in one step.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },

  // ── Fees → AI Stack ───────────────────────────────────────────────────────
  // Scope is deliberately the module-scoped policy subset only. Engine-level
  // settings (providers, model management, global AI policy) stay central and
  // must never be duplicated into a module's AI Stack tab.
  {
    id: 'fees.ai-stack.recommendation-engine',
    module: 'Fees',
    title: 'Recommendation engine for Fees',
    blurb: 'Turn ranked collection and defaulter recommendations on for this module, and set the confidence threshold.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/fees/ai-stack',
  },
  {
    id: 'fees.ai-stack.agent',
    module: 'Fees',
    title: 'Fees agent',
    blurb: 'Let an agent act on fees tasks, with an approval threshold above which a person must confirm.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/fees/ai-stack',
  },
  {
    id: 'fees.ai-stack.knowledge-source',
    module: 'Fees',
    title: 'Knowledge sources for Fees',
    blurb: 'Point the knowledge and retrieval layer at fees policies, circulars and structures.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/fees/ai-stack',
  },
  {
    id: 'fees.ai-stack.usage-audit',
    module: 'Fees',
    title: 'Fees usage and audit view',
    blurb: 'See what the AI did in Fees, what it cost, and who approved it — scoped to this module.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/fees/ai-stack',
  },
  {
    id: 'fees.online-payments',
    module: 'Fees',
    title: 'Online payments',
    blurb: 'Parents pay online, with the receipt and ledger updating themselves.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'fees.reminders',
    module: 'Fees',
    title: 'Fee reminders',
    blurb: 'Automatic reminders before and after a due date, by SMS, email or WhatsApp.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'fees.discounts',
    module: 'Fees',
    title: 'Discounts and scholarships',
    blurb: 'Define who qualifies, take applications, and approve them on a record.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'fees.refunds',
    module: 'Fees',
    title: 'Refunds and adjustments',
    blurb: 'Request, approve and process a refund without editing a ledger by hand.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'fees.approvals',
    module: 'Fees',
    title: 'Approval chains',
    blurb: 'Refunds, discounts and write-offs routed for sign-off, with escalation when nobody responds.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'fees.reconciliation',
    module: 'Fees',
    title: 'Reconciliation',
    blurb: 'Match what the gateway says, what the bank says and what the ledger says.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'fees.reports',
    module: 'Fees',
    title: 'Fee reports',
    blurb: 'Collection, outstanding, demand, discount and refund reports, exportable and schedulable.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'fees.intelligence',
    module: 'Fees',
    title: 'Collection intelligence',
    blurb: 'Collection trends, which families are likely to fall behind, and what to do about it.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard.personalization',
    module: 'Dashboard',
    title: 'Personalise your dashboards',
    blurb: 'Hide or show cards, charts and sections on any dashboard, for your own account only.',
    phase: 'Phase 3',
    status: 'live',
    audience: 'customer',
    href: '/dashboard',
  },
  {
    id: 'dashboard.layout',
    module: 'Dashboard',
    title: 'Dashboard layouts',
    blurb: 'Move and resize widgets, and set a default layout for each role.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
    href: '/dashboard',
  },

  // ── Curriculum → Learning Alignment ───────────────────────────────────────
  // The alignment capability itself is LIVE and must not be marked coming soon.
  // Only the frameworks with no content yet carry a badge.
  {
    id: 'curriculum.framework.casel-sel',
    module: 'Curriculum',
    title: 'CASEL / SEL alignment',
    blurb: 'Social-emotional competencies mapped to specific curriculum concepts.',
    phase: 'Phase 2',
    status: 'live',
    audience: 'customer',
    href: '/pal/frameworks',
  },
  {
    id: 'curriculum.framework.ngss-stem',
    module: 'Curriculum',
    title: 'NGSS / STEM alignment',
    blurb: 'Science and engineering practices mapped to curriculum concepts.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/pal/frameworks',
  },
  {
    id: 'curriculum.framework.vocational-training',
    module: 'Curriculum',
    title: 'Vocational training alignment',
    blurb: 'Trade competencies mapped to the concepts that develop them.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/pal/frameworks',
  },
  {
    id: 'curriculum.alignment-strength',
    module: 'Curriculum',
    title: 'Primary and secondary alignment',
    blurb: 'A lesson can develop several capabilities at once, each marked primary or secondary and each carrying the evidence that it actually happened.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'curriculum.framework.soft-skills',
    module: 'Curriculum',
    title: 'Soft skills alignment',
    blurb: 'Communication, collaboration and self-management mapped to curriculum concepts.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
    href: '/pal/frameworks',
  },

  // ── LMS ───────────────────────────────────────────────────────────────────
  // Named per the settled names in NAMING above.
  // "Interactive Learning" is the capability; H5P is one technology inside it.
  {
    id: 'lms.interactive-learning',
    module: 'Learning',
    title: NAMING.interactiveLearning,
    blurb: 'Interactive activities, simulations and virtual labs as one capability, not one file format.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'learning.ai-tutor',
    module: 'Learning',
    title: 'AI tutor',
    blurb: 'A tutor that works from what a student has actually shown, and will not hand over an answer before a genuine attempt.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'learning.learning-path',
    module: 'Learning',
    title: 'Personal learning path',
    blurb: 'One clear next step per student, ordered by what they have mastered and what it unlocks.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'learning.pedagogy-engine',
    module: 'Learning',
    title: 'Adaptive teaching rules',
    blurb: 'The rules that decide what a struggling student is given next, instead of the same content again.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'learning.content-versioning',
    module: 'Learning',
    title: 'Content versioned by year and board',
    blurb: 'Content tied to a specific curriculum and academic year, so a syllabus change does not rewrite last year.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'learning.universal-content',
    module: 'Learning',
    title: 'One content library',
    blurb: 'The same content object serves self-paced learning, the classroom and formal exams, instead of three copies drifting apart.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'learning.lesson-kit',
    module: 'Learning',
    title: 'Lesson kit',
    blurb: 'Everything for one concept in a single bundle — before class, during class, after class, and the evidence it produced.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },

  // ── Assessment and exams ──────────────────────────────────────────────────
  // The PAL and LMS sheets treat these as a module in their own right, sized
  // alongside Fees, so they are grouped separately rather than folded into
  // Learning where they would be lost.
  {
    id: 'assessment.examination',
    module: 'Assessment and exams',
    title: 'Examination management',
    blurb: 'Exam calendar, paper generation, moderation, marks entry, results and report cards.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'assessment.blueprint',
    module: 'Assessment and exams',
    title: 'Board exam blueprints',
    blurb: 'Papers built to a board pattern — question types, marks weighting and difficulty spread.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'assessment.question-intelligence',
    module: 'Assessment and exams',
    title: 'One question bank',
    blurb: 'The same bank serving practice, diagnostics, mastery checks and formal exams, instead of four separate ones.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'assessment.attainment',
    module: 'Assessment and exams',
    title: 'Coverage and attainment reports',
    blurb: 'Two separate answers: was it taught, and did students actually master it.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },

  // ── Teaching ──────────────────────────────────────────────────────────────
  {
    id: 'teaching.workspace',
    module: 'Teaching',
    title: 'Teacher workspace',
    blurb: 'What to teach, how to teach it, what the class already knows, and who needs help — in one place.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'teaching.authoring',
    module: 'Teaching',
    title: 'Teacher content authoring',
    blurb: 'Teachers with the right permission generate or upload their own material, layered on top of the platform content rather than replacing it.',
    phase: 'Phase 2',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'teaching.content-approval',
    module: 'Teaching',
    title: 'Content approval workflow',
    blurb: 'Draft, preview, publish and school review before teacher-authored content goes wider.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'teaching.academic-operations',
    module: 'Teaching',
    title: 'Academic operations',
    blurb: 'Academic calendar, teaching plans and assignments as the school’s own operational area.',
    phase: 'Phase 3',
    status: 'coming-soon',
    audience: 'customer',
  },
  {
    id: 'lms.quizzes',
    module: 'Learning',
    title: 'Interactive quizzes',
    // Honest status: creating and taking a quiz already works, so this is
    // in-progress rather than coming-soon. The landing screen used to say
    // "coming soon" while linking to a working Create quiz page.
    blurb: 'Quizzes that adapt to each student, with live performance tracking and badges.',
    phase: 'Phase 2',
    status: 'in-progress',
    audience: 'customer',
    href: '/quiz',
  },

  // ── Platform services ─────────────────────────────────────────────────────
  // The Platform Administration screen renders these. Each is one of the shared
  // engines every module is meant to call rather than rebuild.
  {
    id: 'platform.authentication',
    module: 'Platform services',
    title: 'Authentication',
    blurb: 'Sign-in and session handling for web and mobile.',
    phase: 'Phase 2',
    status: 'live',
    audience: 'customer',
    evidence: ['app/login/page.tsx', 'lib/security/session-token.ts'],
  },
  {
    id: 'platform.rbac',
    module: 'Platform services',
    title: 'Roles and permissions',
    blurb: 'One place that decides who may do what, in every module.',
    phase: 'Phase 2',
    status: 'live',
    audience: 'customer',
    evidence: ['app/hooks/usePermission.ts'],
  },
  {
    id: 'platform.audit',
    module: 'Platform services',
    title: 'Audit trail',
    blurb: 'A permanent record of who changed what, and when.',
    phase: 'Phase 2',
    // Verified 2026-10-07: shared append-only platform_audit_log with a viewer
    // (GET /api/platform/audit), written by AuditTrail::record. The platform
    // services write to it today; other modules adopt it by calling the same
    // service. Checked by calling the controllers against the database, not
    // yet over HTTP with a session token.
    status: 'live',
    audience: 'customer',
    href: '/platform-services/audit',
    evidence: ['app/platform-services/audit/page.tsx'],
  },
  {
    id: 'platform.workflow',
    module: 'Platform services',
    title: 'Approval workflows',
    blurb: 'Approval chains, escalation and delegation, configured per module and component and shared by everything that needs a sign-off.',
    phase: 'Phase 2',
    // Verified 2026-10-07: WorkflowEngine runs a configured chain against a
    // record (start, approve, reject, delegate, SLA escalation) and the
    // Approval requests screen drives it. Exercised against the database;
    // modules start a run by calling the engine for their own approval point.
    status: 'live',
    audience: 'customer',
    href: '/platform-services/workflow',
    evidence: ['app/platform-services/workflow/page.tsx', 'app/platform-services/workflow/runs/page.tsx'],
  },
  {
    id: 'platform.notification',
    module: 'Platform services',
    title: 'Notifications',
    blurb: 'Web and email from one service, configured per module and component, with channels a school can switch off centrally. SMS, WhatsApp and mobile are logged as not sent until a provider is connected.',
    phase: 'Phase 2',
    // Verified 2026-10-07: NotificationSender honours the channel switches and
    // per-event settings, sends web and email, retries failures with backoff,
    // and writes every outcome to a delivery log (Delivery log screen).
    // SMS, WhatsApp and push have no provider driver yet, so they are recorded
    // as skipped with the reason and never as sent.
    status: 'live',
    audience: 'customer',
    href: '/platform-services/notification',
    evidence: ['app/platform-services/notification/page.tsx', 'app/platform-services/notification/log/page.tsx'],
  },
  {
    id: 'platform.template',
    module: 'Platform services',
    title: 'Templates and documents',
    blurb: 'Versioned templates with merge fields and PDF output, for receipts, letters and reports.',
    phase: 'Phase 2',
    // Verified 2026-10-07: versioned templates with a merge field catalogue,
    // and a server-side PDF render (POST /api/platform/templates/{id}/pdf)
    // exercised through the controller. Merge values are supplied by the
    // caller; the gallery download leaves them blank.
    status: 'live',
    audience: 'customer',
    href: '/document-templates',
    evidence: ['app/document-templates/page.tsx', 'app/document-templates/api.ts', 'lib/platform/client.ts'],
  },
  {
    id: 'platform.scheduler',
    module: 'Platform services',
    title: 'Scheduler',
    blurb: 'Recurring jobs such as overdue checks and reminder runs, scheduled per module and component. A job runs once its module registers it.',
    phase: 'Phase 2',
    // Verified 2026-10-07: platform:schedule-run ticks every minute, finds due
    // tasks, locks, runs the registered job and records last run. Today one
    // job is registered (notification retry); a configured task with no job
    // is reported as not run, never as ok. Also escalates overdue approvals.
    status: 'live',
    audience: 'customer',
    href: '/platform-services/scheduler',
    evidence: ['app/platform-services/scheduler/page.tsx'],
  },
  {
    id: 'platform.document',
    module: 'Platform services',
    title: 'File storage',
    blurb: 'Upload, version and attach files to any record.',
    phase: 'Phase 2',
    // Verified 2026-10-07: platform_file_attachments with versioning, tenant
    // checked download and soft remove, exercised through the controller. Any
    // screen attaches files by mounting AttachmentsPanel with a record type
    // and id; it is mounted on the File storage screen.
    status: 'live',
    audience: 'customer',
    href: '/platform-services/files',
    evidence: ['app/platform-services/files/page.tsx', 'app/platform-services/_components/AttachmentsPanel.tsx'],
  },
  {
    id: 'platform.integration',
    module: 'Platform services',
    title: 'Integrations',
    blurb: 'One place to hold payment gateway, SMS and bank credentials, instead of one copy per module.',
    phase: 'Phase 2',
    // Verified 2026-10-07: configs are stored centrally in
    // platform_integration_configs (secrets encrypted, masked in every
    // response) through /api/platform/integrations, with a real connectivity
    // test. The integration administration screen now reads and writes it.
    status: 'live',
    audience: 'customer',
    href: '/integration',
    evidence: [
      'app/integration/page.tsx',
      'app/task-management/_lib/integration-management-api.ts',
      'lib/platform/client.ts',
    ],
  },
  {
    id: 'platform.reporting',
    module: 'Platform services',
    title: 'Reporting engine',
    blurb: 'Shared queries, exports and scheduled reports across modules.',
    phase: 'Phase 3',
    // Verified 2026-10-07: ReportCatalog is a shared query layer (a module adds
    // a report with one entry), with CSV export and scheduled runs that store the
    // file in File storage and email the recipients. Exercised through the
    // controller against the database. Four platform reports ship today; other
    // modules add theirs the same way. The older dynamic report builder is
    // separate and unchanged.
    status: 'live',
    audience: 'customer',
    href: '/platform-services/reports',
    evidence: ['app/platform-services/reports/page.tsx', 'app/reports/dynamic-report-builder/page.tsx'],
  },
  {
    id: 'platform.import',
    module: 'Platform services',
    title: 'Data import',
    blurb: 'Bring records in from a spreadsheet, matching columns to fields once for every module.',
    phase: 'Phase 2',
    // Verified 2026-10-07: the backend import API (list tables, parse, match
    // fields, process) is on this branch behind api.session. Listing the 39
    // importable tables and parsing a real CSV against one were run through the
    // controller. The final process step writes to real tables and was not run.
    status: 'live',
    audience: 'customer',
    href: '/import-data',
    evidence: ['app/import-data/page.tsx', 'app/api/import/process/route.ts'],
  },
  {
    id: 'platform.dashboard-engine',
    module: 'Platform services',
    title: 'Dashboard engine',
    blurb: 'Modules register widgets; the platform handles layout, permissions and refresh.',
    phase: 'Phase 3',
    // Verified 2026-10-07: DashboardWidgets takes widget registrations from
    // modules (key, title, right, data provider), filters them by the caller's
    // rights, applies a saved per-user order and hiding, and reads data only for
    // widgets that are shown. Five platform widgets ship today. The existing
    // /dashboard role dashboards have their own widget settings and are not yet
    // moved onto this engine.
    status: 'live',
    audience: 'customer',
    href: '/platform-services/dashboard',
    evidence: ['app/platform-services/dashboard/page.tsx', 'app/dashboard/_lib/useDashboardPreferences.ts'],
  },
  {
    id: 'platform.evidence-engine',
    module: 'Platform services',
    title: 'Student evidence store',
    blurb: 'One record of what each student has demonstrated, drawn from assessments, activity and teacher observation.',
    phase: 'Phase 2',
    // Verified 2026-10-07, backend only: App\Domain\AI\Evidence\EvidenceStore
    // and the pal_learning_evidence table exist on the development branch. There
    // is no screen or cross-module feed yet.
    status: 'in-progress',
    audience: 'customer',
  },
  {
    id: 'platform.event-bus',
    module: 'Platform services',
    title: 'Event bus',
    blurb: 'Modules publish business events that other services can react to.',
    phase: 'Exploring',
    // Verified 2026-10-07: what exists is a read-only monitor over the sync,
    // audit, workflow and failed-job logs. Publishing and subscribing do not.
    status: 'in-progress',
    audience: 'internal',
    href: '/platform-services/event-bus',
    evidence: ['app/platform-services/event-bus/page.tsx'],
  },

  // ── AI and intelligence ───────────────────────────────────────────────────
  {
    id: 'ai.conversational',
    module: 'AI and intelligence',
    title: 'Assistant',
    blurb: 'One assistant that knows which module you are in and answers in that context.',
    phase: 'Phase 2',
    status: 'live',
    audience: 'customer',
  },
  {
    id: 'ai.concept-intelligence',
    module: 'AI and intelligence',
    title: 'Concept intelligence',
    blurb: 'Knowledge, skills, misconceptions and pedagogy for each curriculum concept, with a confidence score.',
    phase: 'Phase 2',
    status: 'live',
    audience: 'customer',
  },
  {
    id: 'ai.gateway',
    module: 'AI and intelligence',
    title: 'AI providers and models',
    blurb: 'Central model access, prompts and cost tracking, so no module holds its own keys.',
    phase: 'Phase 2',
    status: 'live',
    audience: 'customer',
  },
  {
    id: 'ai.agentic-library',
    module: 'AI and intelligence',
    title: 'Agent library',
    // Names K-12 and Enterprise Brain rather than saying "any module", because
    // the row asks the note to signal a specific migration decision, and a
    // vague claim signals nothing. The "keep running unchanged" half matters
    // just as much: this is customer-visible language on a screen someone is
    // relying on today, so it has to reassure as well as inform.
    blurb: 'The agent library is becoming a shared service, so the same agents will serve K-12 and Enterprise Brain. Agents built here today keep running unchanged.',
    phase: 'Phase 2',
    status: 'in-progress',
    audience: 'customer',
    href: '/enterprise-brain/automation/agents',
  },
  {
    id: 'ai.knowledge-graph',
    module: 'AI and intelligence',
    title: 'Knowledge graph',
    blurb: 'The shared evidence store every recommendation is drawn from.',
    phase: 'Phase 2',
    status: 'in-progress',
    audience: 'customer',
  },
  {
    id: 'ai.recommendation-engine',
    module: 'AI and intelligence',
    title: 'Recommendation engine',
    blurb: 'Turns evidence into ranked, explainable recommendations for any module that asks.',
    phase: 'Phase 2',
    status: 'in-progress',
    audience: 'customer',
  },
  {
    id: 'ai.governance',
    module: 'AI and intelligence',
    title: 'Decision approval trail',
    blurb: 'Who or what approved each automated decision, on what evidence, with a human override before it runs.',
    phase: 'Phase 2',
    status: 'coming-soon',
    // Internal only: this row describes a gap in our own controls. It is shown
    // to staff so it gets fixed, and withheld from the customer roadmap until
    // it is built. See the workbook's AI Stack tab, row 4.
    audience: 'internal',
    href: '/enterprise-brain/governance',
  },
];
