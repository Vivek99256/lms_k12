'use client';
<<<<<<< HEAD
import { BellDot } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'notification', title: 'Notification Report', description: 'Review parent notification delivery and read status.', icon: BellDot, path: 'easy_com/notification_report', academic: true, mobile: true, columns: [{ key: 'NOTIFICATION_DATE', label: 'Date' }, { key: 'NOTIFICATION_TYPE', label: 'Type' }, { key: 'student_name', label: 'Student Name' }, { key: 'enrollment_no', label: 'GR No.' }, { key: 'grade_name', label: 'Academic Section' }, { key: 'standard_name', label: 'Standard' }, { key: 'division_name', label: 'Division' }, { key: 'NOTIFICATION_DESCRIPTION', label: 'Notification Text' }, { key: 'IS_READ', label: 'Read/Not Read' }, { key: 'imei_no', label: 'IMEI No.' }, { key: 'mobile', label: 'Mobile' }, { key: 'current_version', label: 'Current Version' }, { key: 'new_version', label: 'New Version' }, { key: 'created_at', label: 'Created On' }] }} />; }
=======

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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
