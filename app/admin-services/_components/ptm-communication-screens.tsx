'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'ptm';

const FIELDS = {
  name: 'Parent name',
  student_name: 'Student name',
  date: 'Meeting date',
  time: 'Time slot',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'ptm-invite',
    name: 'PTM invitation',
    tag: 'Invitation',
    subject: 'Parent-teacher meeting',
    body: 'Dear {name}, a parent-teacher meeting for {student_name} is scheduled on {date}. Please book your slot through the parent app.',
  },
  {
    id: 'ptm-confirmed',
    name: 'Booking confirmed',
    tag: 'Confirmation',
    subject: 'PTM booking confirmed',
    body: 'Dear {name}, your parent-teacher meeting for {student_name} is confirmed on {date} at {time}. Please arrive 10 minutes early.',
  },
  {
    id: 'ptm-missed',
    name: 'Missed meeting follow-up',
    tag: 'Follow-up',
    subject: 'PTM missed',
    body: 'Dear {name}, we missed you at the parent-teacher meeting for {student_name} on {date}. Please contact the class teacher to arrange another time.',
  },
];

export const PTM_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="ptm.notice"
        title="Send PTM notice"
        description="Invite parents to a meeting, confirm a booking, or follow up on a missed meeting."
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
