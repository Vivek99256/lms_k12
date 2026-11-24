'use client';

import React, { useEffect, useState } from 'react';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { resolveDashboardRole, type DashboardRole } from '@/app/dashboard/_lib/resolveDashboardRole';
import AdminDashboard from '@/app/dashboard/AdminDashboard';
import TeacherDashboard from '@/app/dashboard/TeacherDashboard';
import StudentDashboard from '@/app/dashboard/StudentDashboard';
import RoleWorkspaceDashboard from '@/app/dashboard/RoleWorkspaceDashboard';

/**
 * Single post-login destination for every role. Detects the signed-in
 * user's profile (`menuContext.user_profile_name`, set at login by
 * AuthContext) and renders the matching dashboard — the same
 * detect-then-branch pattern already used at app/lms/dashboard/page.tsx.
 * Each dashboard fetches its own data from a role-scoped API that is
 * independently RBAC-checked server-side, so this branch is UX routing only.
 */import { useRegisterPageAiContext } from '@/contexts/PageAiContext';

/**
 * Registers the page shape only, for the dashboards whose tiles are not read from an API.
 *
 * Those tiles are hardcoded placeholders, not retrieved figures. Passing them as `metrics` would put
 * invented numbers into the assistant's prompt, and the grounding rules exist precisely to stop that —
 * so they are deliberately withheld. The role workspace reads real figures and registers them itself,
 * so this must not be mounted there: a parent's registration would overwrite the child's.
 */
function PlaceholderAiContext() {
  useRegisterPageAiContext({
    pageTitle: 'Dashboard',
    pageType: 'dashboard',
  });

  return null;
}

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

  if (role === 'workspace') return <RoleWorkspaceDashboard />;

  return (
    <>
      <PlaceholderAiContext />
      {role === 'teacher' ? <TeacherDashboard /> : role === 'student' ? <StudentDashboard /> : <AdminDashboard />}
    </>
  );
}
