'use client';
<<<<<<< HEAD
import { MessagesSquare } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'sms-staff', title: 'Send SMS Staff', description: 'Select a staff group and send an SMS to active staff.', icon: MessagesSquare, searchPath: 'easy_com/send_sms_staff/create', submitPath: 'easy_com/send_sms_staff', contactLabel: 'Mobile', messageLabel: 'SMS Text', staff: true }} />; }
=======

import { MessagesSquare } from 'lucide-react';
import EntryPage from '../_components/EntryPage';

export default function Page() {
  return (
    <EntryPage
      config={{
        kind: 'sms-staff',
        title: 'Send SMS Staff',
        description: 'Select a staff group and send an SMS to its active members.',
        icon: MessagesSquare,
        recipientsPath: 'send-sms-staff/recipients',
        sendPath: 'send-sms-staff',
        messageField: 'smsText',
        selectionField: 'sendsms',
        selectionKey: 'contact',
        contactLabel: 'Mobile',
        messageLabel: 'SMS text',
        messageMaxLength: 1000,
        staff: true,
      }}
    />
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
