'use client';

import { MailCheck } from 'lucide-react';
import ReportPage from '../_components/ReportPage';

export default function Page() {
  return (
    <ReportPage
      config={{
        kind: 'email',
        title: 'Email Report',
        description: 'Review the emails sent to parents.',
        icon: MailCheck,
        path: 'reports/email',
        optionsPath: 'reports/email/options',
        users: true,
        columns: [
          { key: 'email', label: 'Email', wide: true },
          { key: 'subject', label: 'Subject' },
          { key: 'email_text', label: 'Message', wide: true },
          { key: 'attachment_name', label: 'Attachment' },
          { key: 'sent_on', label: 'Sent on' },
          { key: 'user_name', label: 'Sent by' },
        ],
      }}
    />
  );
}
