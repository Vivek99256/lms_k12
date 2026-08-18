'use client';

import { FileText } from 'lucide-react';
import ReportPage from '../_components/ReportPage';

export default function Page() {
  return (
    <ReportPage
      config={{
        kind: 'sms',
        title: 'Send SMS Report',
        description: 'Review the SMS delivery log for parents or staff.',
        icon: FileText,
        path: 'reports/sms',
        optionsPath: 'reports/sms/options',
        source: true,
        mobile: true,
        academicYear: true,
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'enrollment_no', label: 'GR No.' },
          { key: 'sms_no', label: 'Mobile' },
          { key: 'sms_text', label: 'SMS text', wide: true },
          { key: 'module_name', label: 'Source' },
          { key: 'syear', label: 'Year' },
          { key: 'sent_on', label: 'Sent on' },
        ],
      }}
    />
  );
}
