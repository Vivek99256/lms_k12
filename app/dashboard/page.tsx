'use client';

import React, { useEffect, useState } from 'react';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { resolveDashboardRole, type DashboardRole } from '@/app/dashboard/_lib/resolveDashboardRole';
import AdminDashboard from '@/app/dashboard/AdminDashboard';
import TeacherDashboard from '@/app/dashboard/TeacherDashboard';
import StudentDashboard from '@/app/dashboard/StudentDashboard';

/**
 * Single post-login destination for every role. Detects the signed-in
 * user's profile (`menuContext.user_profile_name`, set at login by
 * AuthContext) and renders the matching dashboard — the same
 * detect-then-branch pattern already used at app/lms/dashboard/page.tsx.
 * Each dashboard fetches its own data from a role-scoped API that is
 * independently RBAC-checked server-side, so this branch is UX routing only.
 */
export default function Dashboard() {
  const [role, setRole] = useState<DashboardRole | null>(null);

  useEffect(() => {
    const ctx = getStoredMenuContext();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(resolveDashboardRole(ctx?.user_profile_name));
  }, []);

  if (!role) {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#4F46E5]" />
      </div>
    );
  }

  if (role === 'teacher') return <TeacherDashboard />;
  if (role === 'student') return <StudentDashboard />;
  return <AdminDashboard />;
}
