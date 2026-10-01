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
  onboarding: ['onboarding', 'onboard', 'setup', 'getting started', 'get started', 'initial setup'],
  'process-builder': ['process builder', 'process', 'processes', 'workflow', 'workflows', 'approval', 'approvals'],
  'master-setup': ['master setup', 'master', 'masters', 'configuration', 'config', 'settings', 'configure'],
  operations: ['operations', 'operation', 'daily operations', 'manage', 'management'],
  reports: ['reports', 'report', 'reporting', 'analytics', 'data', 'statistics', 'stats', 'generate report', 'view reports'],
  intelligence: ['intelligence', 'ai', 'insights', 'smart', 'analysis', 'recommendations', 'ai tools', 'ai stack'],
  'help-guide': ['help', 'help guide', 'support', 'guide', 'documentation', 'docs', 'faq', 'how to', 'tutorial'],
  scheduler: ['scheduler', 'schedule', 'scheduling', 'scheduled', 'cron', 'automated'],
  'audit-trail': ['audit', 'audit trail', 'log', 'logs', 'history', 'activity log'],
};

const NAVIGATION_VERBS = [
  'go to', 'take me to', 'open', 'show me', 'show', 'navigate to', 'switch to',
  'i want to see', 'i need', 'let me see', 'bring up', 'pull up', 'launch',
  'where is', 'where can i find', 'how do i get to', 'find',
];

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

function hasNavigationIntent(text: string): boolean {
  return NAVIGATION_VERBS.some((verb) => containsPhrase(text, verb));
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

  if (!hasVerb && !categoryMatch) return null;

  return {
    route: categoryMatch.route,
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

  if (matchedModuleSlug && (!isDataQuery || lower.includes('onboarding') || isDirectModuleSwitch(lower, matchedModuleSlug))) {
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

    // Supported navigation / action
    const categoryLabel = navMatch?.categoryLabel || (matchedCategoryKey === 'onboarding' ? 'Onboarding' : matchedCategoryKey ? matchedCategoryKey.charAt(0).toUpperCase() + matchedCategoryKey.slice(1) : null);
    
    let route = navMatch?.route || MODULE_DEFAULT_ROUTES[matchedModuleSlug] || `/${matchedModuleSlug}`;
    if (matchedCategoryKey === 'onboarding' && matchedModuleSlug === 'fees') {
      route = '/fees/onboarding';
    }

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
