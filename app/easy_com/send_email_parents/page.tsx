'use client';

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
