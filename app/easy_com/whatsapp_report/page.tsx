'use client';
<<<<<<< HEAD
import { ChartNoAxesColumn } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'whatsapp', title: 'WhatsApp Report', description: 'Review sent WhatsApp messages, statuses, and replies.', icon: ChartNoAxesColumn, path: 'whatsapp-sent-generate-show-report', columns: [{ key: 'enrollment_no', label: 'GR No.' }, { key: 'student_name', label: 'Student Name' }, { key: 'whatsapp_number', label: 'Mobile Number' }, { key: 'created_by_name', label: 'Created By' }, { key: 'sent_date', label: 'Date' }, { key: 'message_status', label: 'Status' }, { key: 'message', label: 'Message' }] }} />; }
=======

import { ChartNoAxesColumn } from 'lucide-react';
import ReportPage from '../_components/ReportPage';

export default function Page() {
  return (
    <ReportPage
      config={{
        kind: 'whatsapp',
        title: 'WhatsApp Report',
        description: 'Review sent WhatsApp messages, delivery status and unread replies.',
        icon: ChartNoAxesColumn,
        path: 'reports/whatsapp',
        academic: true,
        mobile: true,
        columns: [
          { key: 'enrollment_no', label: 'GR No.' },
          { key: 'student_name', label: 'Student name' },
          { key: 'standard_name', label: 'Standard' },
          { key: 'division_name', label: 'Division' },
          { key: 'whatsapp_number', label: 'WhatsApp number' },
          { key: 'message', label: 'Message', wide: true },
          { key: 'message_status', label: 'Status' },
          { key: 'unread_replies', label: 'Unread replies' },
          { key: 'sent_date', label: 'Sent on' },
          { key: 'created_by_name', label: 'Sent by' },
        ],
      }}
    />
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
