'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'organization-management';

const FIELDS = {
  name: 'Employee name',
  department: 'Department',
  item: 'Compliance / policy',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'compliance-due',
    name: 'Compliance due reminder',
    tag: 'Compliance',
    subject: 'Compliance due',
    body: 'Dear {name}, the compliance item "{item}" assigned to you ({department}) is due on {date}. Please complete it and upload the evidence before then.',
  },
  {
    id: 'compliance-overdue',
    name: 'Compliance overdue notice',
    tag: 'Compliance',
    subject: 'Compliance overdue',
    body: 'Dear {name}, the compliance item "{item}" ({department}) was due on {date} and is still open. Please complete it today and contact HR if you need help.',
  },
  {
    id: 'discipline-meeting',
    name: 'Disciplinary meeting call',
    tag: 'Discipline',
    subject: 'Meeting with HR',
    body: 'Dear {name}, you are requested to meet the HR department on {date} regarding a matter recorded for {department}. Please confirm your availability.',
  },
  {
    id: 'org-announcement',
    name: 'General announcement',
    tag: 'Notice',
    subject: 'Announcement from HR',
    body: 'Dear {name}, this is to inform everyone in {department} that {item} comes into effect from {date}.',
  },
];

export const ORG_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="organization-management.notice"
        title="Send organization notice"
        description="Remind employees about a compliance item, call them to a meeting, or announce something to a department."
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
