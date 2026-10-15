/**
 * Client-side navigation-intent detection for the chatbot.
 *
 * When a user types something like "show me Fees onboarding" or "take me to
 * student reports", this module matches the request against the live module
 * category registry — the same data that drives the tab bar — and returns the
 * route to navigate to.
 */

import type {
  ModuleCategory,
  ModuleRegistryEntry,
} from '@/app/_lib/module-categories-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavigationMatch {
  /** The resolved route to push, e.g. '/fees/onboarding'. */
  route: string;
  /** Human-readable module name, e.g. 'Fees'. */
  moduleLabel: string;
  /** Human-readable category name, e.g. 'Onboarding'. */
  categoryLabel: string;
  /** Confidence: 'exact' when both module and category matched unambiguously. */
  confidence: 'exact' | 'likely';
  moduleName?: string;
  categoryKey?: string;
  /** Set when the request named one screen inside a tab, e.g. 'Fee Collect'. */
  itemLabel?: string;
}

export interface ChatbotModuleContext {
  name: string;
  label: string;
}

export type ChatbotIntentEvaluation =
  | {
      type: 'unsupported';
      currentModule: ChatbotModuleContext;
      targetModule: ChatbotModuleContext;
      message: string;
    }
  | {
      type: 'navigation';
      currentModule: ChatbotModuleContext;
      targetModule: ChatbotModuleContext;
      headline: string;
      message: string;
      route: string;
      actionLabel: string;
      navigationMatch?: NavigationMatch;
    }
  | {
      type: 'standard';
      currentModule: ChatbotModuleContext;
    };

// ---------------------------------------------------------------------------
// Module aliases & Routes
// ---------------------------------------------------------------------------

const MODULE_ALIASES: Record<string, string[]> = {
  fees: ['fees', 'fee', 'fee collection', 'fee management', 'billing', 'payment', 'payments'],
  students: ['student', 'students', 'student management', 'student profiles', 'learner', 'learners'],
  admissions: ['admission', 'admissions', 'admission management', 'enrolment', 'enrollment', 'enquiry', 'enquiries'],
  attendance: ['attendance', 'attendance management', 'absent', 'present', 'absentees'],
  transportation: ['transportation', 'transport', 'bus', 'vehicle', 'routes'],
  hostel: ['hostel', 'hostel management', 'boarding', 'dormitory'],
  library: ['library', 'library management', 'books', 'book management'],
  teach_learn: ['teach', 'learn', 'teach/learn', 'teaching', 'learning', 'lms', 'lesson', 'lessons', 'course', 'courses'],
  exam_assessment: ['exam & assessment', 'exam and assessment', 'online exam', 'online exams', 'homework', 'assignment', 'assignments', 'worksheet', 'worksheets'],
  curriculum_planning: ['curriculum', 'curriculum planning', 'lesson plan', 'lesson planning', 'syllabus', 'syllabus plan', 'teacher diary', 'monthly plan'],
  engagement: ['engagement', 'leaderboard', 'leader board', 'portfolio', 'virtual classroom'],
  interactions: ['interactions', 'interaction', 'activity stream'],
  new_pal: ['new pal', 'personalised learning', 'personalized learning', 'coherence map', 'content model'],
  hr: ['hr', 'human resources', 'staff', 'staff management', 'employee', 'employees', 'payroll'],
  exam: ['exam', 'exams', 'examination', 'examinations', 'test', 'tests', 'assessment', 'assessments', 'result', 'results'],
  inventory: ['inventory', 'stock', 'items', 'assets', 'asset management'],
  task_management: ['task', 'tasks', 'task management'],
};

/**
 * The registry names a few modules differently from the slugs this file keys on:
 * the Student menu is `student`, Admission is `admission` and Transport is `transport`,
 * while the aliases, display names and `getCurrentModule()` use `students`,
 * `admissions` and `transportation`. Comparing the two raw made the chatbot tell a
 * person on the Student page that "this action isn't available from the Student module".
 * Every comparison between a registry name and a current-module name goes through here.
 */
const REGISTRY_SLUG_TO_MODULE: Record<string, string> = {
  student: 'students',
  admission: 'admissions',
  transport: 'transportation',
};

export function canonicalModuleName(name?: string | null): string {
  const key = (name || '').toLowerCase().trim();
  return REGISTRY_SLUG_TO_MODULE[key] ?? key;
}

const MODULE_DEFAULT_ROUTES: Record<string, string> = {
  fees: '/fees/onboarding',
  students: '/students/search_student',
  admissions: '/admissions/admission_enquiry',
  attendance: '/attendance/attendance_dashboard',
  transportation: '/transportation',
  hostel: '/hostel',
  library: '/library',
  teach_learn: '/course-master',
  exam_assessment: '/lms/homework',
  curriculum_planning: '/lms/curriculum-planning',
  engagement: '/engagement',
  interactions: '/interactions',
  new_pal: '/new_pal',
  hr: '/hr',
  exam: '/exam',
  inventory: '/inventory',
  task_management: '/tasks',
};

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  fees: 'Fees',
  students: 'Student',
  admissions: 'Admissions',
  attendance: 'Attendance',
  transportation: 'Transportation',
  hostel: 'Hostel',
  library: 'Library',
  teach_learn: 'Teach/Learn',
  exam_assessment: 'Exam & Assessment',
  curriculum_planning: 'Curriculum Planning',
  engagement: 'Engagement',
  interactions: 'Interactions',
  new_pal: 'New PAL',
  hr: 'HR',
  exam: 'Exam',
  inventory: 'Inventory',
  task_management: 'Tasks',
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  onboarding: ['onboarding', 'onboard', 'getting started', 'get started', 'initial setup'],
  'process-builder': ['process builder', 'process', 'processes'],
  'master-setup': ['master setup', 'master', 'masters', 'configuration', 'config', 'settings', 'configure'],
  operations: ['operations', 'operation', 'daily operations'],
  reports: ['reports', 'report', 'reporting', 'analytics', 'statistics', 'stats', 'generate report', 'view reports'],
  intelligence: ['intelligence', 'insights', 'recommendations'],
  'help-guide-support': ['help guide support', 'help guide', 'help', 'support', 'guide', 'documentation', 'docs', 'faq', 'tutorial'],
  communication: ['communication', 'communications', 'notices', 'announcements'],
  'ai-stack': ['ai stack', 'ai tools'],
  workflow: ['workflow', 'workflows', 'approval', 'approvals'],
  // `schedular` is the key as the menu data spells it.
  schedular: ['scheduler', 'schedular', 'schedule', 'scheduling', 'scheduled', 'cron'],
  'audit-trail': ['audit trail', 'audit', 'audit log', 'activity log'],
  'sop-task': ['sop', 'sop task'],
};

// Fixed Fees tab pages (app/fees/<tab>/page.tsx), used only when the live tab list
// is unavailable. Keys are the category keys the menu data uses.
const FALLBACK_TAB_ROUTES: Record<string, Record<string, string>> = {
  fees: {
    onboarding: '/fees/onboarding',
    'process-builder': '/fees/process-builder',
    'master-setup': '/fees/master-setup',
    operations: '/fees/operations',
    reports: '/fees/reports',
    intelligence: '/fees/intelligence',
    'help-guide-support': '/fees/help-guide-support',
    communication: '/fees/communication',
    'ai-stack': '/fees/ai-stack',
    workflow: '/fees/workflow',
    schedular: '/fees/scheduler',
    'audit-trail': '/fees/audit-trail',
  },
};

const FALLBACK_TAB_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  'process-builder': 'Process Builder',
  'master-setup': 'Master Setup',
  operations: 'Operations',
  reports: 'Reports',
  intelligence: 'Intelligence',
  'help-guide-support': 'Help Guide/Support',
  communication: 'Communication',
  'ai-stack': 'AI Stack',
  workflow: 'Workflow',
  schedular: 'Scheduler',
  'audit-trail': 'Audit Trail',
};

// Where a module's pending approvals are decided. This is the Automations tab of the
// module's AI Stack, whose queue already carries Approve/Reject (it calls the same
// resolveApproval the backend exposes), so the chatbot only opens it. Fees only: the
// other modules are added here once their tab ids have been checked.
export const APPROVAL_ROUTES: Record<string, string> = {
  fees: '/fees/ai-stack?tab=automations',
};

/**
 * The modules that have an agent or workflow which pauses for a person, and where each one's
 * queue is: its own AI Stack → Automations tab. These are the modules for which
 * `workflow_definitions` / `ai_agents` hold a flow with an approval step. Every other
 * module has no action that can wait for approval, and the chatbot says so rather than
 * opening an empty tab. A module gains approvals by gaining such a flow — it is added here
 * when that happens, not before.
 */
const APPROVAL_CAPABLE_ROUTES: Record<string, string> = {
  students: '/modules/student/ai-stack?tab=automations',
  attendance: '/modules/attendance/ai-stack?tab=automations',
  admissions: '/modules/admission/ai-stack?tab=automations',
  exam: '/modules/exam/ai-stack?tab=automations',
  'exam-assessment': '/modules/exam-assessment/ai-stack?tab=automations',
  'new-pal': '/modules/new-pal/ai-stack?tab=automations',
};

function hasApprovalFlow(moduleName: string): boolean {
  const key = moduleName.replace(/_/g, '-');
  return key === 'fees' || key in APPROVAL_CAPABLE_ROUTES;
}

export function approvalsRouteFor(pathOrModule?: string | null): string | null {
  // A workspace module key ("exam_assessment") names its module outright.
  const direct = (pathOrModule || '').toLowerCase().trim().replace(/_/g, '-');
  if (direct in APPROVAL_CAPABLE_ROUTES) return APPROVAL_CAPABLE_ROUTES[direct];

  const moduleName = resolveCurrentModule(pathOrModule, []).name.replace(/_/g, '-');
  return APPROVAL_ROUTES[moduleName] ?? APPROVAL_CAPABLE_ROUTES[moduleName] ?? null;
}

/**
 * Where a module's pending approvals are decided, from the live registry.
 *
 * Every module's AI Stack has an Automations tab (`?tab=automations` is how the category
 * page selects it), and that is the queue where a bound agent's or workflow's pending
 * items are approved or rejected. Fees keeps its own page, so it stays in
 * `APPROVAL_ROUTES`; every other module is resolved here from the route its own AI Stack
 * tab already has, which means no route is invented and none can point at another module.
 * A module with no AI Stack tab gets no approvals route and the request falls through.
 */
function registryApprovalRoute(
  moduleName: string,
  registry: ModuleRegistryEntry[],
  categoriesMap: Map<string, ModuleCategory[]>
): string | null {
  const wanted = canonicalModuleName(moduleName);
  const entry = registry.find((candidate) => canonicalModuleName(candidate.moduleName) === wanted);
  if (!entry) return null;

  const aiStack = (categoriesMap.get(entry.moduleName) ?? []).find((category) => category.key === 'ai-stack');
  if (!aiStack?.route) return null;

  return `${aiStack.route}${aiStack.route.includes('?') ? '&' : '?'}tab=automations`;
}

// ---------------------------------------------------------------------------
// Static fallback for when the live registry is not available
// ---------------------------------------------------------------------------

/**
 * The registry is fetched asynchronously, once per session, from the API. When that fetch
 * has not finished, failed, or returned nothing for a module, every request that needed it
 * fell through to the data pipeline: "Open Student onboarding" came back as a list of
 * students and "Show me pending approvals" as "I could not answer that".
 *
 * Every module's tab pages live at one predictable address, `/modules/<module>/<tab>` — the
 * live data was checked and the exceptions are only Fees (its own pages, handled by
 * `FALLBACK_TAB_ROUTES`) and Users (whose tabs are served from `/modules/user-i-card/`,
 * with the AI Stack tab at `/modules/user/ai-stack`). So the destination of a tab request
 * can be known without the registry. The live registry always wins when it has the answer;
 * this only fills the gap when it does not.
 *
 * Circular and Parent Communication are deliberately absent: they have an AI Stack tab and
 * no other, so a "tab" request for either has no fixed destination to fall back to.
 */
interface StaticModule {
  /** The module name the registry uses. */
  slug: string;
  label: string;
  /** Other names the module goes by: the AI module key the workspace sends. */
  aliasKeys: string[];
  tabBase?: string;
  aiStackRoute?: string;
}

const STATIC_MODULES: StaticModule[] = [
  { slug: 'student', label: 'Student', aliasKeys: ['students'] },
  { slug: 'user', label: 'Users', aliasKeys: [], tabBase: '/modules/user-i-card', aiStackRoute: '/modules/user/ai-stack' },
  { slug: 'library', label: 'Library', aliasKeys: [] },
  { slug: 'attendance', label: 'Attendance', aliasKeys: [] },
  { slug: 'mobile-apps', label: 'Mobile Apps', aliasKeys: ['mobile_apps'] },
  { slug: 'communication', label: 'Communication', aliasKeys: ['easy_com'] },
  { slug: 'timetable', label: 'Timetable', aliasKeys: [] },
  { slug: 'exam', label: 'Exam', aliasKeys: [] },
  { slug: 'admission', label: 'Admission', aliasKeys: ['admissions'] },
  { slug: 'inward-outward', label: 'Inward Outward', aliasKeys: ['inward_outward'] },
  { slug: 'petty-cash', label: 'Petty Cash', aliasKeys: ['petty_cash'] },
  { slug: 'hostel', label: 'Hostel', aliasKeys: [] },
  { slug: 'consent', label: 'Consent', aliasKeys: [] },
  { slug: 'ptm', label: 'PTM', aliasKeys: [] },
  { slug: 'visitor-management', label: 'Visitor Management', aliasKeys: ['visitor_management'] },
  { slug: 'transport', label: 'Transport', aliasKeys: ['transportation'] },
  { slug: 'inventory', label: 'Inventory', aliasKeys: [] },
  { slug: 'front-desk', label: 'Front Desk', aliasKeys: ['front_desk'] },
  { slug: 'complaint', label: 'Complaint', aliasKeys: [] },
  { slug: 'utility', label: 'Utility', aliasKeys: ['migration-modules'] },
  { slug: 'document-templates', label: 'Document Templates', aliasKeys: [] },
  { slug: 'teach_learn', label: 'Teach/Learn', aliasKeys: ['teach-learn'], tabBase: '/teach-learn', aiStackRoute: '/teach-learn/ai-stack' },
];

/** The static module a path or module key belongs to, if it is one of them. */
function staticModuleFor(pathOrName?: string | null): StaticModule | null {
  const key = (pathOrName || '').toLowerCase().trim().split('?')[0].replace(/\/+$/, '');
  if (!key) return null;

  const direct = STATIC_MODULES.find((mod) => mod.slug === key || mod.aliasKeys.includes(key));
  if (direct) return direct;

  const byPath = STATIC_MODULES.find((mod) =>
    [`/modules/${mod.slug}`, mod.tabBase].some((base) => base && (key === base || key.startsWith(`${base}/`)))
  );
  if (byPath) return byPath;

  const known = getCurrentModule(key).name;
  if (known === 'general') return null;

  return STATIC_MODULES.find((mod) => canonicalModuleName(mod.slug) === known || mod.aliasKeys.includes(known)) ?? null;
}

function staticTabRoute(mod: StaticModule, categoryKey: string): string {
  if (categoryKey === 'ai-stack' && mod.aiStackRoute) return mod.aiStackRoute;
  return `${mod.tabBase ?? `/modules/${mod.slug}`}/${categoryKey}`;
}

function staticApprovalRoute(moduleName: string): string | null {
  const mod = staticModuleFor(moduleName);
  return mod ? `${staticTabRoute(mod, 'ai-stack')}?tab=automations` : null;
}

/**
 * A tab of the module the user is on, with no module named in the request.
 * The live registry answers first (a module that lacks the tab has no such page, so the
 * request is not a navigation); Fees and the static table cover the registry being absent.
 */
function currentModuleTab(
  currentModule: ChatbotModuleContext,
  categoryKey: string,
  registry: ModuleRegistryEntry[],
  categoriesMap: Map<string, ModuleCategory[]>
): { route: string; label: string } | null {
  const entry = registry.find((candidate) => canonicalModuleName(candidate.moduleName) === currentModule.name);
  const categories = entry ? categoriesMap.get(entry.moduleName) : undefined;

  if (categories?.length) {
    const category = categories.find((candidate) => candidate.key === categoryKey);
    return category?.route ? { route: category.route, label: category.label } : null;
  }

  const label = FALLBACK_TAB_LABELS[categoryKey] ?? categoryKey;

  const feesRoute = currentModule.name === 'fees' ? FALLBACK_TAB_ROUTES.fees?.[categoryKey] : undefined;
  if (feesRoute) return { route: feesRoute, label };

  const mod = staticModuleFor(currentModule.name);
  return mod ? { route: staticTabRoute(mod, categoryKey), label } : null;
}

/**
 * The module the user is on. `getCurrentModule()` only knows about eleven modules by path;
 * every other module's pages resolved to "general", which switched the cross-module guard
 * off for them and left approvals with no module to name. A page under a registry
 * module's own route now resolves to that module.
 */
function resolveCurrentModule(
  pathOrName: string | null | undefined,
  registry: ModuleRegistryEntry[]
): ChatbotModuleContext {
  const known = getCurrentModule(pathOrName);
  if (known.name !== 'general') return known;

  const fromStatic = (): ChatbotModuleContext => {
    const mod = staticModuleFor(pathOrName);
    return mod ? { name: canonicalModuleName(mod.slug), label: mod.label } : known;
  };

  if (!registry.length) return fromStatic();

  const path = (pathOrName || '').toLowerCase().split('?')[0].replace(/\/+$/, '');
  if (!path) return known;

  let best: { entry: ModuleRegistryEntry; length: number } | null = null;
  for (const entry of registry) {
    for (const route of [entry.baseRoute, ...(entry.routes ?? [])]) {
      const candidate = (route || '').toLowerCase().replace(/\/+$/, '');
      if (!candidate || candidate === '/') continue;
      const matches = path === candidate || path.startsWith(`${candidate}/`);
      if (matches && (!best || candidate.length > best.length || (candidate.length === best.length && isNamedAfterLabel(entry) && !isNamedAfterLabel(best.entry)))) {
        best = { entry, length: candidate.length };
      }
    }
  }

  return best
    ? { name: canonicalModuleName(best.entry.moduleName), label: best.entry.label || best.entry.moduleName }
    : fromStatic();
}

// "Show me pending approvals", "take me to staff approval", "approve this action",
// "approve the pending fees action". Questions ("how many…", "why…") are left alone.
const APPROVAL_PATTERN =
  /\b(pending approvals?|staff approvals?|approvals? queue|waiting for (staff )?approval|approve (this|the|that|pending|my)\b[\w\s]*\b(action|request|process)|pending (\w+ )?actions?)\b/;
const APPROVAL_QUESTION_START = /^(how many|what|why|who|which|explain|tell me)\b/;

// Verbs that always mean "take me there".
const NAVIGATION_VERBS = [
  'go to', 'take me to', 'open', 'navigate to', 'switch to', 'bring up', 'pull up',
  'launch', 'where is', 'where can i find', 'how do i get to',
];

// Verbs that also mean "give me the data" ("show me the fees report"). They only
// navigate when the sentence names a destination: tab, page, screen or module.
const SOFT_NAVIGATION_VERBS = ['show me', 'show', 'i want to see', 'let me see', 'i need', 'find'];
const DESTINATION_WORDS = ['tab', 'page', 'screen', 'module', 'section'];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s/-]/g, '').replace(/\s+/g, ' ');
}

function containsPhrase(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(haystack);
}

// LMS + PAL page families, matched on route prefixes (lower-cased path).
const EXAM_ASSESSMENT_PATH = /\/(lms\/(homework|lmsassignment|lmsannotate_assignment|worksheet|project|question-wise-report)|exam\/(online|progress-report)|question_paper|lmsassignment_submission|exam-assessment)/;
const CURRICULUM_PATH = /\/(lms\/(curriculum-planning|monthly-plan|lesson-plan|teacher-diary|book-list|syllabus-plan)|curriculum-planning)/;
const ENGAGEMENT_PATH = /\/(engagement|lmsleaderboard|lmssocialcollabrotive|lmsportfolio|lmsvirtualclassroom)/;
const INTERACTIONS_PATH = /\/(interactions|lmsactivitystream|lmscommunication|lb_master|lms\/student-analysis|lms\/dashboard)/;
const NEW_PAL_PATH = /\/(new_pal|new-pal|coherence)/;

export function getCurrentModule(
  pathnameOrName?: string | null,
  workspaceModule?: string | null
): ChatbotModuleContext {
  const path = (pathnameOrName || '').toLowerCase().trim();

  if (path.includes('/fees') || path === 'fees' || path === 'fee') {
    return { name: 'fees', label: 'Fees' };
  }
  // LMS + PAL pages come before the generic `/student`, `/exam` and `/result` tests below:
  // `/lms/student-analysis` and `/exam/online` would otherwise be claimed by Student and Exam.
  if (EXAM_ASSESSMENT_PATH.test(path) || path === 'exam_assessment') {
    return { name: 'exam_assessment', label: 'Exam & Assessment' };
  }
  if (CURRICULUM_PATH.test(path) || path === 'curriculum_planning') {
    return { name: 'curriculum_planning', label: 'Curriculum Planning' };
  }
  if (ENGAGEMENT_PATH.test(path) || path === 'engagement') {
    return { name: 'engagement', label: 'Engagement' };
  }
  if (INTERACTIONS_PATH.test(path) || path === 'interactions') {
    return { name: 'interactions', label: 'Interactions' };
  }
  if (NEW_PAL_PATH.test(path) || path === 'new_pal') {
    return { name: 'new_pal', label: 'New PAL' };
  }
  if (path.includes('/students') || path.includes('/student') || path === 'students' || path === 'student') {
    return { name: 'students', label: 'Student' };
  }
  if (path.includes('/admissions') || path.includes('/admission') || path === 'admissions' || path === 'admission') {
    return { name: 'admissions', label: 'Admissions' };
  }
  if (path.includes('/attendance') || path === 'attendance') {
    return { name: 'attendance', label: 'Attendance' };
  }
  if (path.includes('/exam') || path.includes('/result') || path === 'exam' || path === 'exams') {
    return { name: 'exam', label: 'Exam' };
  }
  if (path.includes('/hr') || path.includes('/staff') || path === 'hr') {
    return { name: 'hr', label: 'HR' };
  }
  if (path.includes('/library') || path === 'library') {
    return { name: 'library', label: 'Library' };
  }
  if (path.includes('/transport') || path.includes('/bus') || path === 'transportation') {
    return { name: 'transportation', label: 'Transportation' };
  }
  if (path.includes('/hostel') || path === 'hostel') {
    return { name: 'hostel', label: 'Hostel' };
  }
  if (path.includes('/inventory') || path === 'inventory') {
    return { name: 'inventory', label: 'Inventory' };
  }
  if (path.includes('/course-master') || path.includes('/teach') || path === 'teach_learn') {
    return { name: 'teach_learn', label: 'Teach/Learn' };
  }

  if (workspaceModule) {
    const wm = workspaceModule.toLowerCase().trim();
    if (wm === 'student' || wm === 'students') return { name: 'students', label: 'Student' };
    if (wm === 'fees' || wm === 'fee') return { name: 'fees', label: 'Fees' };
    if (wm === 'admissions' || wm === 'admission') return { name: 'admissions', label: 'Admissions' };
    if (wm === 'attendance') return { name: 'attendance', label: 'Attendance' };
    if (wm === 'exam') return { name: 'exam', label: 'Exam' };
    if (wm === 'hr') return { name: 'hr', label: 'HR' };
    return { name: wm, label: MODULE_DISPLAY_NAMES[wm] || (wm.charAt(0).toUpperCase() + wm.slice(1)) };
  }

  return { name: 'general', label: 'General' };
}

function matchModuleSlug(lowerText: string): string | null {
  let bestSlug: string | null = null;
  let bestLength = 0;
  for (const [slug, aliases] of Object.entries(MODULE_ALIASES)) {
    for (const alias of aliases) {
      if (containsPhrase(lowerText, alias) && alias.length > bestLength) {
        bestSlug = slug;
        bestLength = alias.length;
      }
    }
  }
  // The modules with no alias list (Users, Petty Cash, Hostel…) are named by their label,
  // so that naming one works when the live registry is not there to supply it.
  // A name that is also a tab name ("Communication") is skipped: "open Communication in
  // Fees module" asks for Fees' Communication tab, not for the Communication module.
  const tabWords = new Set([
    ...Object.values(CATEGORY_ALIASES).flat(),
    ...Object.values(FALLBACK_TAB_LABELS).map((label) => label.toLowerCase()),
  ]);
  for (const mod of STATIC_MODULES) {
    for (const phrase of [mod.label.toLowerCase(), mod.slug.replace(/-/g, ' ')]) {
      if (tabWords.has(phrase)) continue;
      if (containsPhrase(lowerText, phrase) && phrase.length > bestLength) {
        bestSlug = canonicalModuleName(mod.slug);
        bestLength = phrase.length;
      }
    }
  }
  return bestSlug;
}

/**
 * The request with the named module's own name taken out, so that a module called
 * "Communication" is not also read as a request for the Communication tab.
 */
function withoutModuleName(lowerText: string, moduleSlug: string | null): string {
  if (!moduleSlug) return lowerText;
  const mod = staticModuleFor(moduleSlug);
  const phrases = [
    ...(MODULE_ALIASES[moduleSlug] ?? []),
    ...(mod ? [mod.label.toLowerCase(), mod.slug.replace(/-/g, ' ')] : []),
  ].filter((phrase) => containsPhrase(lowerText, phrase));
  const longest = phrases.sort((a, b) => b.length - a.length)[0];
  if (!longest) return lowerText;
  const escaped = longest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return lowerText.replace(new RegExp(`\\b${escaped}\\b`, 'i'), ' ').replace(/\s+/g, ' ').trim();
}

function matchCategoryKey(lowerText: string): string | null {
  let bestKey: string | null = null;
  let bestLength = 0;
  for (const [key, aliases] of Object.entries(CATEGORY_ALIASES)) {
    for (const alias of aliases) {
      if (containsPhrase(lowerText, alias) && alias.length > bestLength) {
        bestKey = key;
        bestLength = alias.length;
      }
    }
  }
  return bestKey;
}

function isDirectModuleSwitch(lowerText: string, moduleSlug: string): boolean {
  const aliases = MODULE_ALIASES[moduleSlug] || [moduleSlug];
  for (const alias of aliases) {
    if (
      containsPhrase(lowerText, `${alias} module`) ||
      containsPhrase(lowerText, `module ${alias}`) ||
      lowerText === `open ${alias}` ||
      lowerText === `open ${alias} module` ||
      lowerText === `go to ${alias}` ||
      lowerText === `go to ${alias} module` ||
      lowerText === `navigate to ${alias}` ||
      lowerText === `navigate to ${alias} module`
    ) {
      return true;
    }
  }
  return false;
}

function matchModule(
  text: string,
  registry: ModuleRegistryEntry[]
): ModuleRegistryEntry | null {
  let bestMatch: ModuleRegistryEntry | null = null;
  let bestLength = 0;

  for (const entry of registry) {
    const aliases = MODULE_ALIASES[entry.moduleName] ?? [];
    const candidates = [
      entry.label.toLowerCase(),
      entry.moduleName.toLowerCase().replace(/_/g, ' '),
      ...aliases,
    ];

    for (const alias of candidates) {
      if (!containsPhrase(text, alias)) continue;
      // Two registry entries can share one menu label (the Users menu is claimed by
      // both `user` and `user-i-card`). On a tie the entry named after the label wins.
      const tiedButBetterNamed =
        alias.length === bestLength && bestMatch !== null && isNamedAfterLabel(entry) && !isNamedAfterLabel(bestMatch);
      if (alias.length > bestLength || tiedButBetterNamed) {
        bestMatch = entry;
        bestLength = alias.length;
      }
    }
  }

  return bestMatch;
}

function isNamedAfterLabel(entry: ModuleRegistryEntry): boolean {
  const name = entry.moduleName.toLowerCase().replace(/[_-]/g, ' ');
  const label = entry.label.toLowerCase();
  return name === label || `${name}s` === label || name === `${label}s`;
}

function matchCategory(
  text: string,
  categories: ModuleCategory[]
): ModuleCategory | null {
  let bestMatch: ModuleCategory | null = null;
  let bestLength = 0;

  for (const category of categories) {
    const aliases = CATEGORY_ALIASES[category.key] ?? [];
    const candidates = [
      category.label.toLowerCase(),
      category.key.toLowerCase().replace(/-/g, ' '),
      ...aliases,
    ];

    for (const alias of candidates) {
      if (containsPhrase(text, alias) && alias.length > bestLength) {
        bestMatch = category;
        bestLength = alias.length;
      }
    }
  }

  return bestMatch;
}

/** The phrases that name a module: its label, its slug and its aliases. */
function modulePhrases(entry: ModuleRegistryEntry): string[] {
  return [
    entry.label.toLowerCase(),
    entry.moduleName.toLowerCase().replace(/[_-]/g, ' '),
    ...(MODULE_ALIASES[entry.moduleName] ?? []),
    ...(MODULE_ALIASES[canonicalModuleName(entry.moduleName)] ?? []),
  ].map((phrase) => normalize(phrase)).filter(Boolean);
}

/**
 * The request with the module's own name taken out. Tab names are matched against this,
 * because the module's name is not a request for a tab: "Open Communication onboarding"
 * must open Onboarding, not the Communication tab that the word "communication" also names.
 */
function withoutModulePhrase(text: string, entry: ModuleRegistryEntry): string {
  const found = modulePhrases(entry)
    .filter((phrase) => containsPhrase(text, phrase))
    .sort((a, b) => b.length - a.length)[0];
  if (!found) return text;
  const escaped = found.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\b${escaped}\\b`, 'i'), ' ').replace(/\s+/g, ' ').trim();
}

function matchItem(
  text: string,
  categories: ModuleCategory[],
  /** Items that only repeat the module's own name, ignored when a tab was asked for. */
  ignoreLabels?: Set<string>
): { category: ModuleCategory; item: ModuleCategory['items'][number] } | null {
  let best: { category: ModuleCategory; item: ModuleCategory['items'][number] } | null = null;
  let bestLength = 0;

  for (const category of categories) {
    for (const item of category.items ?? []) {
      const label = normalize(item.label);
      if (ignoreLabels?.has(label)) continue;
      if (label.length > 3 && item.link && containsPhrase(text, label) && label.length > bestLength) {
        best = { category, item };
        bestLength = label.length;
      }
    }
  }

  return best;
}

function hasNavigationIntent(text: string): boolean {
  if (NAVIGATION_VERBS.some((verb) => containsPhrase(text, verb))) return true;
  return (
    SOFT_NAVIGATION_VERBS.some((verb) => containsPhrase(text, verb)) &&
    (DESTINATION_WORDS.some((word) => containsPhrase(text, word)) || namesATabOutright(text))
  );
}

// "Show me master setup" is a request for the Master Setup screen, not a question: a tab named by a
// phrase of two or more words ("master setup", "process builder") is not something a data question
// says. One-word tabs ("reports", "operations") stay ambiguous and still need a destination word.
function namesATabOutright(text: string): boolean {
  return Object.values(CATEGORY_ALIASES)
    .flat()
    .some((alias) => alias.includes(' ') && containsPhrase(text, alias));
}

export function detectNavigationIntent(
  userMessage: string,
  registry: ModuleRegistryEntry[],
  categoriesMap: Map<string, ModuleCategory[]>
): NavigationMatch | null {
  const text = normalize(userMessage);

  if (!text) return null;

  const hasVerb = hasNavigationIntent(text);
  const moduleMatch = matchModule(text, registry);
  if (!moduleMatch) return null;

  const categories = categoriesMap.get(moduleMatch.moduleName);
  if (!categories?.length) {
    if (!hasVerb) return null;
    const defaultRoute = MODULE_DEFAULT_ROUTES[moduleMatch.moduleName] || moduleMatch.baseRoute;
    return {
      route: defaultRoute,
      moduleLabel: moduleMatch.label || MODULE_DISPLAY_NAMES[moduleMatch.moduleName] || moduleMatch.moduleName,
      categoryLabel: 'Module',
      confidence: 'likely',
      moduleName: moduleMatch.moduleName,
    };
  }

  const categoryMatch = matchCategory(withoutModulePhrase(text, moduleMatch), categories);

  // A named screen ("open fee collect") is more specific than its tab. Its link is
  // the one the tab's own card opens, so the chatbot adds no route of its own. When a
  // tab WAS asked for, a screen that merely repeats the module's name ("Petty Cash" in
  // Petty Cash) is not the more specific thing: "Go to Petty Cash reports" is Reports.
  const itemMatch = matchItem(
    text,
    categories,
    categoryMatch ? new Set(modulePhrases(moduleMatch)) : undefined
  );
  if (
    itemMatch &&
    hasVerb &&
    (!categoryMatch || normalize(itemMatch.item.label).length > normalize(categoryMatch.label).length)
  ) {
    return {
      route: itemMatch.item.link,
      moduleLabel: moduleMatch.label || MODULE_DISPLAY_NAMES[moduleMatch.moduleName] || moduleMatch.moduleName,
      categoryLabel: itemMatch.category.label,
      confidence: 'exact',
      moduleName: moduleMatch.moduleName,
      categoryKey: itemMatch.category.key,
      itemLabel: itemMatch.item.label,
    };
  }

  if (!categoryMatch) {
    if (!hasVerb) return null;

    const firstCategory = categories[0];
    return {
      route: firstCategory.route || MODULE_DEFAULT_ROUTES[moduleMatch.moduleName] || moduleMatch.baseRoute,
      moduleLabel: moduleMatch.label || MODULE_DISPLAY_NAMES[moduleMatch.moduleName] || moduleMatch.moduleName,
      categoryLabel: firstCategory.label,
      confidence: 'likely',
      moduleName: moduleMatch.moduleName,
      categoryKey: firstCategory.key,
    };
  }

  // No navigation verb means a question about the data, never a request to move.
  if (!hasVerb) return null;

  return {
    route: categoryMatch.route || `${moduleMatch.baseRoute || MODULE_DEFAULT_ROUTES[moduleMatch.moduleName] || ""}/${categoryMatch.key}`.replace(/\/+/g, '/'),
    moduleLabel: moduleMatch.label || MODULE_DISPLAY_NAMES[moduleMatch.moduleName] || moduleMatch.moduleName,
    categoryLabel: categoryMatch.label,
    confidence: hasVerb ? 'exact' : 'likely',
    moduleName: moduleMatch.moduleName,
    categoryKey: categoryMatch.key,
  };
}

export function evaluateChatbotIntent(
  userMessage: string,
  currentModulePathOrName?: string | null,
  registry: ModuleRegistryEntry[] = [],
  categoriesMap: Map<string, ModuleCategory[]> = new Map()
): ChatbotIntentEvaluation {
  const currentModule = resolveCurrentModule(currentModulePathOrName, registry);
  const text = normalize(userMessage);

  if (!text) {
    return { type: 'standard', currentModule };
  }

  const lower = text.toLowerCase();

  // 0. Approvals: open the screen where staff decide. The chatbot never approves or
  // rejects itself — that decision stays with the staff member, on the existing screen.
  if (APPROVAL_PATTERN.test(lower) && !APPROVAL_QUESTION_START.test(lower)) {
    const approvalText = lower.replace(/staff approvals?/g, '');
    const namedInRegistry = matchModule(approvalText, registry);
    const approvalModule =
      matchModuleSlug(approvalText) ??
      (namedInRegistry ? canonicalModuleName(namedInRegistry.moduleName) : null) ??
      currentModule.name;
    // A module with no flow that can pause for a person has nothing to approve: say so,
    // rather than opening a tab that can only ever be empty.
    if (approvalModule !== 'general' && !hasApprovalFlow(approvalModule)) {
      const label =
        (namedInRegistry && canonicalModuleName(namedInRegistry.moduleName) === approvalModule ? namedInRegistry.label : null) ??
        (currentModule.name === approvalModule ? currentModule.label : null) ??
        staticModuleFor(approvalModule)?.label ??
        MODULE_DISPLAY_NAMES[approvalModule];

      if (label) {
        return {
          type: 'unsupported',
          currentModule,
          targetModule: { name: approvalModule, label },
          message: `${label} has no actions that wait for approval, so there is nothing to approve here.`,
        };
      }
    }

    const approvalRoute =
      APPROVAL_ROUTES[approvalModule] ??
      registryApprovalRoute(approvalModule, registry, categoriesMap) ??
      // Only when the registry has no entry at all for the module: a registry that is
      // loaded and says the module has no AI Stack tab is believed.
      (registry.some((entry) => canonicalModuleName(entry.moduleName) === approvalModule)
        ? null
        : staticApprovalRoute(approvalModule));
    if (approvalRoute) {
      const moduleLabel =
        MODULE_DISPLAY_NAMES[approvalModule] ??
        (namedInRegistry && canonicalModuleName(namedInRegistry.moduleName) === approvalModule ? namedInRegistry.label : null) ??
        (currentModule.name === approvalModule ? currentModule.label : null) ??
        approvalModule;
      return {
        type: 'navigation',
        currentModule,
        targetModule: { name: approvalModule, label: moduleLabel },
        headline: `${moduleLabel} Approvals`,
        message: `Open the ${moduleLabel} approvals queue.`,
        route: approvalRoute,
        actionLabel: `Open ${moduleLabel} Approvals`,
        navigationMatch: {
          route: approvalRoute,
          moduleLabel,
          categoryLabel: 'Approvals',
          confidence: 'exact',
          moduleName: approvalModule,
        },
      };
    }
  }

  // 0.5. A tab of the module the user is already in, with no module named:
  // "Go to onboarding", "open reports". That is a request to move within the current
  // module and nothing else — no data is fetched and no module is asked about.
  if (
    currentModule.name !== 'general' &&
    hasNavigationIntent(lower) &&
    !matchModule(lower, registry) &&
    !matchModuleSlug(lower)
  ) {
    // The current module's own name is taken out first: in Communication, "open Communication
    // onboarding" asks for Onboarding, and the word is only a tab name when nothing else is.
    const tabKey =
      matchCategoryKey(withoutModuleName(lower, currentModule.name)) ?? matchCategoryKey(lower);
    const asksForData =
      ['pending', 'whose', 'owing', 'class', 'due', 'balance', 'details'].some((word) => lower.includes(word)) &&
      !lower.includes('onboarding');

    if (tabKey && !asksForData) {
      const tab = currentModuleTab(currentModule, tabKey, registry, categoriesMap);

      if (tab) {
        return {
          type: 'navigation',
          currentModule,
          targetModule: currentModule,
          headline: `${currentModule.label} ${tab.label}`,
          message: `Open the ${currentModule.label} ${tab.label.toLowerCase()} process.`,
          route: tab.route,
          actionLabel: `Open ${currentModule.label} ${tab.label}`,
          navigationMatch: {
            route: tab.route,
            moduleLabel: currentModule.label,
            categoryLabel: tab.label,
            confidence: 'exact',
            moduleName: currentModule.name,
            categoryKey: tabKey,
          },
        };
      }
    }
  }

  // 1. Navigation / Module action intent detection
  const navMatch = detectNavigationIntent(userMessage, registry, categoriesMap);
  const matchedModuleSlug = canonicalModuleName(navMatch?.moduleName) || matchModuleSlug(lower);
  const matchedCategoryKey = navMatch?.categoryKey || matchCategoryKey(withoutModuleName(lower, matchedModuleSlug));

  // Exclude standard data queries from being misinterpreted as navigation (e.g. "Whose fees are pending?")
  const isDataQuery =
    lower.includes('pending') ||
    lower.includes('whose') ||
    lower.includes('owing') ||
    lower.includes('class') ||
    lower.includes('due') ||
    lower.includes('balance') ||
    lower.includes('details');

  const wantsNavigation = hasNavigationIntent(lower) || isDirectModuleSwitch(lower, matchedModuleSlug ?? '');

  // A request that names one of the module's own screens ("Open Assign Class Teacher")
  // is not a data question just because a screen's name contains "class" or "pending".
  const namesAScreen = Boolean(navMatch?.itemLabel) && navMatch?.confidence === 'exact';

  if (matchedModuleSlug && wantsNavigation && (!isDataQuery || namesAScreen || lower.includes('onboarding') || isDirectModuleSwitch(lower, matchedModuleSlug))) {
    const targetModuleLabel = MODULE_DISPLAY_NAMES[matchedModuleSlug] || navMatch?.moduleLabel || staticModuleFor(matchedModuleSlug)?.label || (matchedModuleSlug.charAt(0).toUpperCase() + matchedModuleSlug.slice(1));
    const isDirectSwitch = isDirectModuleSwitch(lower, matchedModuleSlug);

    // If currently in a specific module (e.g. 'students') and target action belongs to another module (e.g. 'fees'),
    // AND it's not a direct request to switch modules ("Open Fees module"),
    // then this action is unsupported in the current module context!
    if (
      currentModule.name !== 'general' &&
      currentModule.name !== matchedModuleSlug &&
      !isDirectSwitch
    ) {
      return {
        type: 'unsupported',
        currentModule,
        targetModule: { name: matchedModuleSlug, label: targetModuleLabel },
        message: `This action isn’t available from the ${currentModule.label} module. What would you like to check in the ${currentModule.label} module?`,
      };
    }

    // The live tab list is preferred. Without it (not loaded yet, or the server
    // route, which has none) fall back to the module's fixed tab pages. A named tab
    // with no known route is never replaced by the module default — that is what
    // opened Onboarding for every request.
    const staticModule = staticModuleFor(matchedModuleSlug);
    const fallback = matchedCategoryKey
      ? FALLBACK_TAB_ROUTES[matchedModuleSlug]?.[matchedCategoryKey] ??
        (staticModule ? staticTabRoute(staticModule, matchedCategoryKey) : undefined)
      : undefined;
    if (!navMatch && matchedCategoryKey && !fallback) {
      return { type: 'standard', currentModule };
    }

    const categoryLabel =
      navMatch?.itemLabel ||
      navMatch?.categoryLabel ||
      (matchedCategoryKey
        ? FALLBACK_TAB_LABELS[matchedCategoryKey] ||
          matchedCategoryKey.charAt(0).toUpperCase() + matchedCategoryKey.slice(1)
        : null);

    const route =
      navMatch?.route ||
      fallback ||
      MODULE_DEFAULT_ROUTES[matchedModuleSlug] ||
      (staticModule ? staticTabRoute(staticModule, 'onboarding') : `/${matchedModuleSlug}`);

    const headline = categoryLabel
      ? `${targetModuleLabel} ${categoryLabel}`
      : `${targetModuleLabel} Module`;

    const message = categoryLabel
      ? `Open the ${targetModuleLabel} ${categoryLabel.toLowerCase()} process.`
      : `Open the ${targetModuleLabel} module.`;

    const actionLabel = categoryLabel
      ? `Open ${targetModuleLabel} ${categoryLabel}`
      : `Open ${targetModuleLabel} Module`;

    return {
      type: 'navigation',
      currentModule,
      targetModule: { name: matchedModuleSlug, label: targetModuleLabel },
      headline,
      message,
      route,
      actionLabel,
      navigationMatch: navMatch || {
        route,
        moduleLabel: targetModuleLabel,
        categoryLabel: categoryLabel || 'Module',
        confidence: 'exact',
        moduleName: matchedModuleSlug,
        categoryKey: matchedCategoryKey || undefined,
      },
    };
  }

  return { type: 'standard', currentModule };
}

export function navigationMessage(match: NavigationMatch): string {
  return `Navigating to **${match.moduleLabel}** → **${match.categoryLabel}**`;
}

// ---------------------------------------------------------------------------
// Modules the menu has but the category registry does not
// ---------------------------------------------------------------------------

/**
 * Alumni Management is a level-2 menu with nine screens and no row in the category
 * registry, so the chatbot could not open it by name. Its screens are listed here as the
 * menu names them (`tblmenumaster`, parent 893), as a supplement that is only used when
 * the registry has no entry of its own: the day the registry gains one, that wins.
 */
const SUPPLEMENTAL_ALUMNI_SCREENS: Array<[string, string]> = [
  ['Alumni Dashboard', '/alumni/dashboard'],
  ['Alumni List', '/alumni/list'],
  ['Add Alumni', '/alumni/add'],
  ['Alumni Directory', '/alumni/directory'],
  ['Alumni Events', '/alumni/events'],
  ['Alumni Surveys', '/alumni/surveys'],
  ['Alumni Reports', '/alumni/reports'],
  ['Import Alumni', '/alumni/import'],
  ['Alumni Audit Log', '/alumni/audit'],
];

export function withSupplementalModules(
  registry: ModuleRegistryEntry[],
  categoriesMap: Map<string, ModuleCategory[]>
): { registry: ModuleRegistryEntry[]; categoriesMap: Map<string, ModuleCategory[]> } {
  const hasAlumni = registry.some((entry) => /^alumni/.test(entry.moduleName.toLowerCase()));
  if (hasAlumni) return { registry, categoriesMap };

  const next = new Map(categoriesMap);
  next.set('alumni', [
    {
      key: 'operations',
      label: 'Operations',
      description: 'Alumni Management screens.',
      route: '/alumni/dashboard',
      onboardingModuleKey: '',
      platformModuleKey: '',
      auditModuleKeys: [],
      items: SUPPLEMENTAL_ALUMNI_SCREENS.map(([label, link], index) => ({ id: -(index + 1), label, link })),
    },
  ]);

  return {
    registry: [
      ...registry,
      { moduleName: 'alumni', level2MenuId: null, label: 'Alumni Management', categoryCount: 1, baseRoute: '/alumni', routes: [] },
    ],
    categoriesMap: next,
  };
}
