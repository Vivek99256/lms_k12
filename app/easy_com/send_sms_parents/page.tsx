'use client';

import { MessageSquareText } from 'lucide-react';
import EntryPage from '../_components/EntryPage';

export default function Page() {
  return (
    <EntryPage
      config={{
        kind: 'sms-parents',
        title: 'Send SMS Parents',
        description: 'Select a class and send an SMS to the parents’ registered mobile numbers.',
        icon: MessageSquareText,
        recipientsPath: 'send-sms-parents/recipients',
        sendPath: 'send-sms-parents',
        messageField: 'smsText',
        selectionField: 'sendsms',
        selectionKey: 'contact',
        contactLabel: 'Mobile',
        messageLabel: 'SMS text',
        messageMaxLength: 1000,
      }}
    />
  );
}
