'use client';
<<<<<<< HEAD
import { MessageSquareText } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'sms-parents', title: 'Send SMS Parents', description: 'Select students and send an SMS to parent mobile numbers.', icon: MessageSquareText, searchPath: 'easy_com/send_sms_parents/create', submitPath: 'easy_com/send_sms_parents', contactLabel: 'Mobile', messageLabel: 'SMS Text' }} />; }
=======

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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
