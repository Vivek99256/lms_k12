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
  hr: ['hr', 'human resources', 'staff', 'staff management', 'employee', 'employees', 'payroll'],
  exam: ['exam', 'exams', 'examination', 'examinations', 'test', 'tests', 'assessment', 'assessments', 'result', 'results'],
  inventory: ['inventory', 'stock', 'items', 'assets', 'asset management'],
  task_management: ['task', 'tasks', 'task management'],
};

const MODULE_DEFAULT_ROUTES: Record<string, string> = {
  fees: '/fees/onboarding',
  students: '/students/search_student',
  admissions: '/admissions/admission_enquiry',
  attendance: '/attendance/attendance_dashboard',
  transportation: '/transportation',
  hostel: '/hostel',
  library: '/library',
  teach_learn: '/course-master',
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

export function approvalsRouteFor(pathOrModule?: string | null): string | null {
  const moduleName = getCurrentModule(pathOrModule).name;
  return APPROVAL_ROUTES[moduleName] ?? null;
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

export function getCurrentModule(
  pathnameOrName?: string | null,
  workspaceModule?: string | null
): ChatbotModuleContext {
  const path = (pathnameOrName || '').toLowerCase().trim();

  if (path.includes('/fees') || path === 'fees' || path === 'fee') {
    return { name: 'fees', label: 'Fees' };
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
  return bestSlug;
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
      if (containsPhrase(text, alias) && alias.length > bestLength) {
        bestMatch = entry;
        bestLength = alias.length;
      }
    }
  }

  return bestMatch;
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

function matchItem(
  text: string,
  categories: ModuleCategory[]
): { category: ModuleCategory; item: ModuleCategory['items'][number] } | null {
  let best: { category: ModuleCategory; item: ModuleCategory['items'][number] } | null = null;
  let bestLength = 0;

  for (const category of categories) {
    for (const item of category.items ?? []) {
      const label = normalize(item.label);
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
    DESTINATION_WORDS.some((word) => containsPhrase(text, word))
  );
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

  const categoryMatch = matchCategory(text, categories);

  // A named screen ("open fee collect") is more specific than its tab. Its link is
  // the one the tab's own card opens, so the chatbot adds no route of its own.
  const itemMatch = matchItem(text, categories);
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
  const currentModule = getCurrentModule(currentModulePathOrName);
  const text = normalize(userMessage);

  if (!text) {
    return { type: 'standard', currentModule };
  }

  const lower = text.toLowerCase();

  // 0. Approvals: open the screen where staff decide. The chatbot never approves or
  // rejects itself — that decision stays with the staff member, on the existing screen.
  if (APPROVAL_PATTERN.test(lower) && !APPROVAL_QUESTION_START.test(lower)) {
    const approvalModule = matchModuleSlug(lower.replace(/staff approvals?/g, '')) ?? currentModule.name;
    const approvalRoute = APPROVAL_ROUTES[approvalModule];
    if (approvalRoute) {
      const moduleLabel = MODULE_DISPLAY_NAMES[approvalModule] ?? approvalModule;
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

  // 1. Navigation / Module action intent detection
  const navMatch = detectNavigationIntent(userMessage, registry, categoriesMap);
  const matchedModuleSlug = navMatch?.moduleName || matchModuleSlug(lower);
  const matchedCategoryKey = navMatch?.categoryKey || matchCategoryKey(lower);

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

  if (matchedModuleSlug && wantsNavigation && (!isDataQuery || lower.includes('onboarding') || isDirectModuleSwitch(lower, matchedModuleSlug))) {
    const targetModuleLabel = MODULE_DISPLAY_NAMES[matchedModuleSlug] || navMatch?.moduleLabel || (matchedModuleSlug.charAt(0).toUpperCase() + matchedModuleSlug.slice(1));
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
    const fallback = matchedCategoryKey ? FALLBACK_TAB_ROUTES[matchedModuleSlug]?.[matchedCategoryKey] : undefined;
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
      navMatch?.route || fallback || MODULE_DEFAULT_ROUTES[matchedModuleSlug] || `/${matchedModuleSlug}`;

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
