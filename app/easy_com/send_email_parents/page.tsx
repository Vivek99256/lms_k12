'use client';
<<<<<<< HEAD
import { Mail } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'email-parents', title: 'Send Email Parents', description: 'Compose an email for selected parent email addresses.', icon: Mail, searchPath: 'easy_com/send_email_parents/create', submitPath: 'easy_com/send_email_parents/send_email', contactLabel: 'Email', messageLabel: 'Email Content', email: true }} />; }
=======

import { Mail } from 'lucide-react';
import EntryPage from '../_components/EntryPage';

export default function Page() {
  return (
    <EntryPage
      config={{
        kind: 'email-parents',
        title: 'Send Email Parents',
        description: 'Compose an email for the parents of a selected class.',
        icon: Mail,
        recipientsPath: 'send-email-parents/recipients',
        sendPath: 'send-email-parents',
        messageField: 'content',
        selectionField: 'sendsms',
        selectionKey: 'contact',
        contactLabel: 'Email',
        messageLabel: 'Email content',
        email: true,
      }}
    />
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
