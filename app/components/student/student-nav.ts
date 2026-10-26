import {
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  type LucideIcon,
  Megaphone,
  Rocket,
  Trophy,
  Users,
  Video,
} from 'lucide-react';
import type { Level3Item, MenuItem } from '@/app/data/menuItems';
import { mapApiLinkToRoute } from '@/app/data/routeMapper';

export interface StudentNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface StudentNavSection {
  id: string;
  label: string;
  items: StudentNavItem[];
}

const ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/homework|assignment/i, ClipboardList],
  [/exam|question|test/i, FileText],
  [/leader|rank/i, Trophy],
  [/social|communit|collab/i, Users],
  [/virtual|class(room)?\b|video|live/i, Video],
  [/portfolio/i, Briefcase],
  [/calendar|timetable|holiday/i, CalendarDays],
  [/circular|announce|notice/i, Megaphone],
  [/career|occupation|college|course profile|employer/i, Rocket],
  [/pal|learn|ulu|unified|journey|concept/i, GraduationCap],
  [/course|catalog|book|chapter/i, BookOpen],
];

export function iconForLabel(label: string): LucideIcon {
  return ICON_RULES.find(([rule]) => rule.test(label))?.[1] ?? Layers;
}

function resolveHref(item: { link?: string | null; href?: string }): string {
  const fromLink = item.link ? mapApiLinkToRoute(item.link) : '';
  const href = fromLink && fromLink !== '#' ? fromLink : item.href ?? '';
  return href.startsWith('/') && !href.startsWith('//') ? href : '';
}

interface TreeNode {
  label: string;
  link?: string | null;
  href?: string;
  submenus?: TreeNode[];
  children?: TreeNode[];
}

/**
 * Flattens the rights-filtered menu tree into the few flat sections a student
 * shell shows. The tree is already limited to what the signed-in student may
 * open, so permissions stay server-driven; this only changes presentation.
 */
export function buildStudentNav(menuItems: MenuItem[]): StudentNavSection[] {
  const sections: StudentNavSection[] = [];
  const seenHrefs = new Set<string>();

  const sectionFor = (label: string): StudentNavSection => {
    const id = label.trim().toLowerCase();
    let section = sections.find((candidate) => candidate.id === id);
    if (!section) {
      section = { id, label, items: [] };
      sections.push(section);
    }
    return section;
  };

  // Sections are named after the level-2 group a screen lives in; a level-2 screen
  // with no children of its own sits under its level-1 module.
  const walk = (node: TreeNode, depth: number, l1: string, l2: string) => {
    const kids = (node.submenus ?? node.children ?? []) as TreeNode[];

    if (kids.length === 0) {
      const href = resolveHref(node);
      if (!href || seenHrefs.has(href)) return;
      seenHrefs.add(href);
      const sectionLabel = depth >= 2 ? l2 : depth === 1 ? l1 : 'General';
      sectionFor(sectionLabel).items.push({
        label: node.label,
        href,
        icon: iconForLabel(node.label),
      });
      return;
    }

    for (const child of kids) {
      walk(child, depth + 1, depth === 0 ? node.label : l1, depth === 1 ? node.label : l2);
    }
  };

  for (const l1 of menuItems) walk(l1 as unknown as TreeNode, 0, l1.label, l1.label);

  return sections.filter((section) => section.items.length > 0);
}

/** Routes a student may always open, regardless of how the menu is configured. */
const BASELINE_PREFIXES = ['/dashboard', '/modules', '/teach-learn', '/pal', '/lms', '/exam/online', '/alumni/student', '/profile'];

/**
 * Pages a student reaches from inside the app (links on their own pages) that no menu row points
 * at. Exact paths only: /student is the learner's chapter browser, whereas its sub-routes
 * (/student/add_student, /student/student_health, ...) are staff screens and stay refused.
 */
const BASELINE_EXACT = ['/student'];

function pathOf(href: string): string {
  return href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

function startsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isStudentRouteAllowed(pathname: string, sections: StudentNavSection[]): boolean {
  const path = pathOf(pathname);
  if (path === '/') return true;
  if (BASELINE_EXACT.includes(path)) return true;
  if (BASELINE_PREFIXES.some((prefix) => startsWithSegment(path, prefix))) return true;
  return sections.some((section) =>
    section.items.some((item) => startsWithSegment(path, pathOf(item.href))),
  );
}

/**
 * The level-3 screens of whichever level-2 module the current page belongs to,
 * so the student shell can draw the same tab bar the staff shell does.
 */
export function findLevel3ForPath(
  menuItems: MenuItem[],
  pathname: string,
): { parentLabel: string; items: Level3Item[] } | null {
  const path = pathOf(pathname);
  for (const l1 of menuItems) {
    for (const l2 of l1.submenus ?? []) {
      const items = l2.submenus ?? [];
      if (items.some((item) => {
        const href = resolveHref(item);
        return href && startsWithSegment(path, pathOf(href));
      })) {
        return { parentLabel: l2.label, items };
      }
    }
  }
  return null;
}
