'use client';

import React, { useMemo } from 'react';
import {
  BookOpenCheck, CalendarCheck, CalendarClock, ClipboardList, Megaphone, Send, UserPlus, Wallet, type LucideIcon,
} from 'lucide-react';
import { useShellMenu } from '@/app/components/shell-menu-context';
import { buildMenuSearchIndex, type MenuSearchEntry } from '@/app/data/menuSearch';
import { EmptyState, QuickActionTile } from '@/app/dashboard/_components/DashboardPrimitives';

/**
 * Frequent admin tasks, each tied to the menu screen(s) that perform it.
 *
 * `screens` are tblmenumaster names (case-insensitive, first match wins). An action is
 * shown only when one of its screens is in the signed-in user's own rights-filtered
 * menu — so this list can never offer a screen the menu would not, and it follows
 * whatever rights the school has configured without a second permission check here.
 */
const ACTIONS: Array<{ id: string; label: string; icon: LucideIcon; screens: string[] }> = [
  { id: 'add-student', label: 'Add student', icon: UserPlus, screens: ['add student'] },
  { id: 'collect-fees', label: 'Collect fees', icon: Wallet, screens: ['fees collect', 'fee collect'] },
  { id: 'attendance', label: 'Mark attendance', icon: CalendarCheck, screens: ['student attendance'] },
  { id: 'enquiry', label: 'New enquiry', icon: ClipboardList, screens: ['admission inquiry', 'admission enquiry'] },
  { id: 'circular', label: 'Post circular', icon: Megaphone, screens: ['circular'] },
  { id: 'notify-parents', label: 'Notify parents', icon: Send, screens: ['send notification parents', 'send sms parents'] },
  { id: 'homework', label: 'Homework', icon: BookOpenCheck, screens: ['student homework'] },
  { id: 'timetable', label: 'Timetable', icon: CalendarClock, screens: ['create timetable', 'view classwise timetable'] },
];

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export function AdminQuickActions() {
  const { menuItems, loading, navigate } = useShellMenu();

  const available = useMemo(() => {
    const byLabel = new Map<string, MenuSearchEntry>();
    for (const entry of buildMenuSearchIndex(menuItems)) {
      // Screens (level 3) and single-screen modules (level 2, e.g. "Circular") both qualify.
      if (entry.level === 1 || !entry.route) continue;
      const key = normalize(entry.label);
      if (!byLabel.has(key)) byLabel.set(key, entry);
    }
    return ACTIONS.flatMap((action) => {
      const entry = action.screens.map((s) => byLabel.get(s)).find(Boolean);
      return entry ? [{ ...action, entry }] : [];
    });
  }, [menuItems]);

  if (loading && menuItems.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (available.length === 0) {
    return <EmptyState message="No shortcuts are available for your role. Use the menu to find a screen." />;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {available.map((action) => (
        <QuickActionTile key={action.id} label={action.label} icon={action.icon} onClick={() => navigate(action.entry)} />
      ))}
    </div>
  );
}

/** Whether the user's menu includes a module with this label — used to gate module-specific panels. */
export function useHasMenuModule(label: string) {
  const { menuItems, loading } = useShellMenu();
  const has = useMemo(() => {
    const target = normalize(label);
    return menuItems.some((l1) => l1.submenus?.some((l2) => normalize(l2.label) === target));
  }, [menuItems, label]);
  return { has, loading };
}
