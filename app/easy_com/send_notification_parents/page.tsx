'use client';
<<<<<<< HEAD
import { BellRing } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'notification-parents', title: 'Send Notification Parents', description: 'Send app notifications to selected parents.', icon: BellRing, searchPath: 'easy_com/send_notification_parents/create', submitPath: 'easy_com/send_notification_parents', contactLabel: 'Mobile', messageLabel: 'Notification Text' }} />; }
=======

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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
