'use client';
<<<<<<< HEAD
import { MailCheck } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'email', title: 'Email Report', description: 'Review emails sent to parents.', icon: MailCheck, path: 'easy_com/send_email_report', user: true, submit: true, columns: [{ key: 'EMAIL', label: 'Email' }, { key: 'SUBJECT', label: 'Subject' }, { key: 'EMAIL_TEXT', label: 'Message' }, { key: 'ATTACHMENT', label: 'Attachment' }, { key: 'created_at', label: 'Sent On' }, { key: 'user_name', label: 'Sent By' }] }} />; }
=======

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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
