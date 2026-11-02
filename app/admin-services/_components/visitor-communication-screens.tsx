'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'visitor-management';

const FIELDS = {
  name: 'Recipient name',
  visitor_name: 'Visitor name',
  date: 'Date',
  time: 'Time',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'visitor-arrived',
    name: 'Visitor arrived (to staff)',
    tag: 'Arrival',
    subject: 'Visitor waiting for you',
    body: 'Dear {name}, {visitor_name} has arrived at the school to meet you at {time} on {date}. Please contact the reception.',
  },
  {
    id: 'appointment-confirmed',
    name: 'Appointment confirmed (to visitor)',
    tag: 'Appointment',
    subject: 'Visit confirmed',
    body: 'Dear {visitor_name}, your visit to the school is confirmed for {date} at {time}. Please carry a photo ID and report at the reception.',
  },
  {
    id: 'visit-thanks',
    name: 'Thanks for visiting',
    tag: 'Exit',
    subject: 'Thank you for visiting',
    body: 'Dear {visitor_name}, thank you for visiting the school on {date}. We hope your visit was helpful.',
  },
];

export const VISITOR_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="visitor-management.notice"
        title="Send visitor notice"
        description="Tell a staff member their visitor has arrived, or confirm a visit and thank a visitor."
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
