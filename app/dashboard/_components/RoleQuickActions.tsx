'use client';

import React, { useMemo } from 'react';
import {
  BarChart3, BookOpen, CalendarCheck, CalendarClock, ClipboardCheck, ClipboardList, DoorOpen, FileText, Inbox, ListChecks,
  Megaphone, MessageSquareText, Package, PenLine, ReceiptIndianRupee, ScanLine, Search, Send, Store, UserPlus, Wallet, type LucideIcon,
} from 'lucide-react';
import { useShellMenu } from '@/app/components/shell-menu-context';
import { buildMenuSearchIndex, type MenuSearchEntry } from '@/app/data/menuSearch';
import { SECTION_ACCENT, type Accent } from '@/app/dashboard/_components/dashboard-accents';

/**
 * Every shortcut a role dashboard can offer, each tied to the menu screen(s) that perform it.
 *
 * `screens` are tblmenumaster names (case-insensitive, first match wins). A shortcut is shown only
 * when one of its screens is in the signed-in user's own rights-filtered menu, so this list can
 * never offer a screen the sidebar would not — it follows whatever rights the school has
 * configured (see config/role_dashboards.php) without a second permission check here.
 */
export const QUICK_ACTIONS = {
  'search-student': { label: 'Find student', icon: Search, screens: ['search/edit student'], accent: SECTION_ACCENT.students },
  'add-student': { label: 'Add student', icon: UserPlus, screens: ['add student'], accent: SECTION_ACCENT.students },
  'collect-fees': { label: 'Collect fees', icon: Wallet, screens: ['fees collect', 'fee collect'], accent: SECTION_ACCENT.fees },
  'fees-report': { label: 'Fees report', icon: ReceiptIndianRupee, screens: ['fees collection report'], accent: SECTION_ACCENT.fees },
  defaulters: { label: 'Fee defaulters', icon: BarChart3, screens: ['fees defaulter report'], accent: SECTION_ACCENT.admissions },
  attendance: { label: 'Attendance', icon: CalendarCheck, screens: ['student attendance'], accent: SECTION_ACCENT.attendance },
  enquiry: { label: 'New enquiry', icon: ClipboardList, screens: ['admission inquiry', 'admission enquiry'], accent: SECTION_ACCENT.admissions },
  circular: { label: 'Circulars', icon: Megaphone, screens: ['circular'], accent: SECTION_ACCENT.communication },
  notify: { label: 'Notify parents', icon: Send, screens: ['send notification parents', 'send sms parents'], accent: SECTION_ACCENT.staff },
  'parent-comm': { label: 'Parent messages', icon: MessageSquareText, screens: ['parent communication'], accent: SECTION_ACCENT.communication },
  visitor: { label: 'Add visitor', icon: DoorOpen, screens: ['add visitor'], accent: SECTION_ACCENT.staff },
  'front-desk': { label: 'Front desk', icon: DoorOpen, screens: ['front desk'], accent: SECTION_ACCENT.staff },
  inward: { label: 'Add inward', icon: Inbox, screens: ['add inward'], accent: SECTION_ACCENT.academics },
  'petty-cash': { label: 'Petty cash', icon: Wallet, screens: ['petty cash'], accent: SECTION_ACCENT.celebrations },
  task: { label: 'Tasks', icon: ListChecks, screens: ['task management'], accent: SECTION_ACCENT.academics },
  leave: { label: 'Apply leave', icon: CalendarClock, screens: ['leave application'], accent: SECTION_ACCENT.celebrations },
  complaint: { label: 'Complaints', icon: ClipboardCheck, screens: ['complaint management'], accent: SECTION_ACCENT.communication },
  timetable: { label: 'Timetable', icon: CalendarClock, screens: ['view classwise timetable', 'create timetable'], accent: SECTION_ACCENT.celebrations },
  'book-resources': { label: 'Books', icon: BookOpen, screens: ['book resources'], accent: SECTION_ACCENT.academics },
  'quick-return': { label: 'Quick return', icon: ScanLine, screens: ['quick return'], accent: SECTION_ACCENT.attendance },
  'scan-book': { label: 'Scan book', icon: ScanLine, screens: ['scan book'], accent: SECTION_ACCENT.staff },
  overdue: { label: 'Overdue books', icon: BarChart3, screens: ['issue/overdue report'], accent: SECTION_ACCENT.admissions },
  requisition: { label: 'Requisitions', icon: FileText, screens: ['requisition form'], accent: SECTION_ACCENT.students },
  'requisition-approved': { label: 'Approved requisitions', icon: ClipboardCheck, screens: ['requisition form approved'], accent: SECTION_ACCENT.attendance },
  po: { label: 'Purchase orders', icon: Package, screens: ['generat po'], accent: SECTION_ACCENT.fees },
  receivable: { label: 'Receive items', icon: Inbox, screens: ['item receivable'], accent: SECTION_ACCENT.staff },
  'item-master': { label: 'Item master', icon: Store, screens: ['inventory item master'], accent: SECTION_ACCENT.academics },
  'mark-entry': { label: 'Mark entry', icon: PenLine, screens: ['mark entry'], accent: SECTION_ACCENT.students },
  'exam-schedule': { label: 'Exam schedule', icon: CalendarClock, screens: ['exam schedule'], accent: SECTION_ACCENT.admissions },
  'exam-creation': { label: 'Create exam', icon: ClipboardList, screens: ['exam creation'], accent: SECTION_ACCENT.academics },
  result: { label: 'Result report', icon: BarChart3, screens: ['result report'], accent: SECTION_ACCENT.attendance },
  strength: { label: 'Student strength', icon: BarChart3, screens: ['student strength report'], accent: SECTION_ACCENT.students },
} as const satisfies Record<string, { label: string; icon: LucideIcon; screens: readonly string[]; accent: Accent }>;

export type QuickActionId = keyof typeof QUICK_ACTIONS;

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export function RoleQuickActions({ ids }: { ids: readonly QuickActionId[] }) {
  const { menuItems, loading, navigate } = useShellMenu();

  const available = useMemo(() => {
    const byLabel = new Map<string, MenuSearchEntry>();
    for (const entry of buildMenuSearchIndex(menuItems)) {
      // Screens (level 3) and single-screen modules (level 2, e.g. "Circular") both qualify.
      if (entry.level === 1 || !entry.route) continue;
      const key = normalize(entry.label);
      if (!byLabel.has(key)) byLabel.set(key, entry);
    }
    return ids.flatMap((id) => {
      const action = QUICK_ACTIONS[id];
      const entry = action.screens.map((s) => byLabel.get(s)).find(Boolean);
      return entry ? [{ id, ...action, entry }] : [];
    });
  }, [menuItems, ids]);

  if (loading && menuItems.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (available.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">No shortcuts are available for your role yet. Use the menu to find a screen.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {available.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => navigate(action.entry)}
          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 outline-none transition-[background-color,border-color,transform] duration-150 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:scale-[0.98] motion-reduce:transition-none"
        >
          <action.icon size={16} strokeWidth={1.75} className="shrink-0 text-indigo-600" aria-hidden />
          <span className="truncate">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
