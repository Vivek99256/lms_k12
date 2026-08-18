'use client';

import { MessageCircleMore } from 'lucide-react';
import EntryPage from '../_components/EntryPage';

export default function Page() {
  return (
    <EntryPage
      config={{
        kind: 'whatsapp-parents',
        title: 'Send WhatsApp Parents',
        description: 'Send a WhatsApp Cloud API message to the parents of a selected class.',
        icon: MessageCircleMore,
        recipientsPath: 'send-whatsapp-parents/recipients',
        sendPath: 'send-whatsapp-parents',
        messageField: 'message',
        selectionField: 'sendNotification',
        selectionKey: 'studentId',
        contactLabel: 'WhatsApp mobile',
        messageLabel: 'WhatsApp message',
      }}
    />
  );
}
