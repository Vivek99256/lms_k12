'use client';
<<<<<<< HEAD
import { MessageCircleMore } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'whatsapp-parents', title: 'Send WhatsApp Parents', description: 'Send WhatsApp Cloud API messages to selected parents.', icon: MessageCircleMore, searchPath: 'whatsapp-send-messages/add', submitPath: 'whatsapp-send-messages/store', contactLabel: 'WhatsApp Mobile', messageLabel: 'WhatsApp Message' }} />; }
=======

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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
