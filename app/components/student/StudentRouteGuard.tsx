'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

import { useShellMenu } from '@/app/components/shell-menu-context';
import { buildStudentNav, isStudentRouteAllowed } from './student-nav';

/**
 * Keeps a student on the screens their menu rights open. The shell around it is the
 * same one staff use (same sidebar, category bar and screen tabs, driven by the
 * rights-filtered menu), so a student sees exactly the structure an admin sees,
 * limited to what they were granted; this only refuses staff-only URLs typed in or
 * linked to from elsewhere. Each API still enforces its own authorisation.
 */
export default function StudentRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const { menuItems, loading } = useShellMenu();
  const sections = useMemo(() => buildStudentNav(menuItems), [menuItems]);

  const menuReady = !loading && menuItems.length > 0;
  if (!menuReady || isStudentRouteAllowed(pathname, sections)) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <ShieldAlert size={28} />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-slate-900">This page isn&apos;t part of your student account</h1>
      <p className="mt-2 text-sm text-slate-500">
        It&apos;s meant for school staff. Everything you can use is in the menu, starting with your dashboard.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Back to my dashboard
      </Link>
    </div>
  );
}
