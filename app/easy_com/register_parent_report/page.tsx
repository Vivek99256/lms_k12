'use client';

import { UserCheck } from 'lucide-react';
import ReportPage from '../_components/ReportPage';

export default function Page() {
  return (
    <ReportPage
      config={{
        kind: 'register-parent',
        title: 'Register Parent Report',
        description: 'Review the parent devices registered for app notifications.',
        icon: UserCheck,
        path: 'reports/register-parent',
        academic: true,
        mobile: true,
        columns: [
          { key: 'student_name', label: 'Student name' },
          { key: 'enrollment_no', label: 'GR No.' },
          { key: 'grade_name', label: 'Academic section' },
          { key: 'standard_name', label: 'Standard' },
          { key: 'division_name', label: 'Division' },
          { key: 'mobile_no', label: 'Mobile' },
          { key: 'imei_no', label: 'Device / IMEI No.' },
          { key: 'current_version', label: 'Current version' },
          { key: 'new_version', label: 'New version' },
          { key: 'registered_on', label: 'Registered on' },
        ],
      }}
    />
  );
}
