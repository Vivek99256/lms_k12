'use client';
<<<<<<< HEAD
import { FileText } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'sms', title: 'Send SMS Report', description: 'Review parent and staff SMS delivery logs.', icon: FileText, path: 'easy_com/send_sms_report', academic: true, columns: [{ key: 'name', label: 'Name' }, { key: 'SMS_NO', label: 'Mobile' }, { key: 'SMS_TEXT', label: 'SMS Text' }, { key: 'MODULE_NAME', label: 'Source' }, { key: 'created_on', label: 'Sent On' }] }} />; }
=======

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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
