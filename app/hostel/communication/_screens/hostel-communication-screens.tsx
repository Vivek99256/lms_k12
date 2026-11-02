'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'hostel';

const FIELDS = {
  name: 'Parent / resident name',
  student_name: 'Resident name',
  room: 'Room / block',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'room-allotted',
    name: 'Room allotment intimation',
    tag: 'Allocation',
    subject: 'Hostel room allotted',
    body: 'Dear {name}, {student_name} has been allotted hostel room {room} with effect from {date}. Please contact the hostel warden for joining formalities.',
  },
  {
    id: 'visitor-notice',
    name: 'Visitor meeting notice',
    tag: 'Visitor',
    subject: 'Visitor for hostel resident',
    body: 'Dear {name}, a visitor met {student_name} (Room {room}) at the hostel on {date}. Please contact the warden for details.',
  },
  {
    id: 'hostel-notice',
    name: 'General hostel notice',
    tag: 'Notice',
    subject: 'Hostel notice',
    body: 'Dear {name}, this is to inform you that {student_name} (Room {room}) is requested to contact the hostel office on {date}.',
  },
];

export const HOSTEL_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="hostel.notice"
        title="Send hostel notice"
        description="Tell a parent or resident about a room allotment, a visitor or a hostel instruction."
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
