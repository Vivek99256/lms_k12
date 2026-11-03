'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'complaint';

const FIELDS = {
  name: 'Complainant name',
  title: 'Complaint title',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'complaint-received',
    name: 'Complaint received',
    tag: 'Received',
    subject: 'Complaint received',
    body: 'Dear {name}, we have received your complaint "{title}" on {date}. The school will look into it and respond shortly.',
  },
  {
    id: 'complaint-resolved',
    name: 'Complaint resolved',
    tag: 'Resolved',
    subject: 'Complaint resolved',
    body: 'Dear {name}, your complaint "{title}" has been resolved on {date}. Please contact the school office if you need anything further.',
  },
  {
    id: 'complaint-meeting',
    name: 'Request for a meeting',
    tag: 'Follow-up',
    subject: 'Meeting regarding your complaint',
    body: 'Dear {name}, regarding your complaint "{title}", you are requested to meet the school office on {date}.',
  },
];

export const COMPLAINT_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="complaint.notice"
        title="Send complaint notice"
        description="Acknowledge a complaint, tell the complainant it is resolved, or ask them to meet the school."
        templates={TEMPLATES}
        fields={FIELDS}
      />
    ),
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <ModuleDeliveryLog moduleKey={MODULE_KEY} />,
  },
];
