'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'front-desk';

const FIELDS = {
  name: 'Recipient name',
  visitor_name: 'Visitor name',
  date: 'Date',
  time: 'Time',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'visitor-waiting',
    name: 'Visitor waiting at front desk',
    tag: 'Arrival',
    subject: 'Visitor at front desk',
    body: 'Dear {name}, {visitor_name} is waiting at the front desk to meet you ({date}, {time}). Please contact the reception.',
  },
  {
    id: 'meeting-request',
    name: 'Request to visit the school',
    tag: 'Request',
    subject: 'Please visit the school',
    body: 'Dear {name}, you are requested to visit the school front desk on {date} at {time}. Please carry a photo ID.',
  },
  {
    id: 'visit-thanks',
    name: 'Thanks for visiting',
    tag: 'Exit',
    subject: 'Thank you for visiting',
    body: 'Dear {visitor_name}, thank you for visiting the school on {date}. We hope your visit was helpful.',
  },
];

export const FRONT_DESK_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="front-desk.notice"
        title="Send front desk notice"
        description="Tell a staff member their visitor is waiting, ask a parent to visit, or thank a visitor."
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
