'use client';

import { BellDot } from 'lucide-react';
import ReportPage from '../_components/ReportPage';

export default function Page() {
  return (
    <ReportPage
      config={{
        kind: 'notification',
        title: 'Notification Report',
        description: 'Review parent notification delivery and read status.',
        icon: BellDot,
        path: 'reports/notification',
        optionsPath: 'reports/notification/options',
        academic: true,
        mobile: true,
        academicYear: true,
        columns: [
          { key: 'notification_date', label: 'Date' },
          { key: 'notification_type', label: 'Type' },
          { key: 'student_name', label: 'Student name' },
          { key: 'enrollment_no', label: 'GR No.' },
          { key: 'grade_name', label: 'Academic section' },
          { key: 'standard_name', label: 'Standard' },
          { key: 'division_name', label: 'Division' },
          { key: 'notification_text', label: 'Notification text', wide: true },
          { key: 'read_status', label: 'Read status' },
          { key: 'imei_no', label: 'IMEI No.' },
          { key: 'mobile_no', label: 'Mobile' },
          { key: 'current_version', label: 'Current version' },
          { key: 'new_version', label: 'New version' },
          { key: 'created_on', label: 'Created on' },
        ],
      }}
    />
  );
}
