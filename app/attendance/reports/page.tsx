'use client';

import { useMemo } from 'react';
import { ModuleCategoryPage } from '@/app/_components/module-category-page';
import {
  ATTENDANCE_REPORT_SCREENS,
  STUDENT_ATTENDANCE_REPORT_SCREENS,
} from '@/app/attendance/reports/_screens/attendance-report-screens';
import { getFeesSession } from '@/app/fees/_lib/fees-api';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { isStudentProfile } from '@/lib/ai/adapters/shared-utils';

/**
 * Attendance -> Reports page.
 *
 * Provides:
 * - Admin / Staff view: HRMS Staff Attendance Report and Student Class Registers.
 * - Student view: Strictly read-only student personal attendance statement with zero CRUD operations.
 */
export default function Page() {
  const session = getFeesSession();
  const menuContext = getStoredMenuContext();

  const userProfileName = session.userProfileName || menuContext?.user_profile_name || '';
  const isStudent = isStudentProfile(userProfileName);

  const screens = useMemo(() => {
    return isStudent ? STUDENT_ATTENDANCE_REPORT_SCREENS : ATTENDANCE_REPORT_SCREENS;
  }, [isStudent]);

  return (
    <ModuleCategoryPage
      moduleName="attendance"
      categoryKey="reports"
      staticScreens={screens}
      platformModuleKey="attendance"
    />
  );
}

