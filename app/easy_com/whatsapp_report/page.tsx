'use client';

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
