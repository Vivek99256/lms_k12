'use client';

import { BellRing } from 'lucide-react';
import EntryPage from '../_components/EntryPage';

export default function Page() {
  return (
    <EntryPage
      config={{
        kind: 'notification-parents',
        title: 'Send Notification Parents',
        description: 'Push an in-app notification to the parents of a selected class.',
        icon: BellRing,
        recipientsPath: 'send-notification-parents/recipients',
        sendPath: 'send-notification-parents',
        messageField: 'notificationText',
        selectionField: 'sendNotification',
        selectionKey: 'contact',
        contactLabel: 'Mobile',
        messageLabel: 'Notification text',
        messageMaxLength: 1000,
        academicYear: true,
      }}
    />
  );
}
