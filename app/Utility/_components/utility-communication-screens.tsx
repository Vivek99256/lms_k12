'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'utility';

const FIELDS = {
  name: 'Parent name',
  student_name: 'Student name',
  class: 'Class / division',
  year: 'Academic year',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'rollover-done',
    name: 'Promoted to the next year',
    tag: 'Rollover',
    subject: 'Promoted to the next academic year',
    body: 'Dear {name}, {student_name} has been moved to {class} for the academic year {year}. The new session begins on {date}.',
  },
  {
    id: 'student-transfer',
    name: 'Class or division change',
    tag: 'Transfer',
    subject: 'Class or division changed',
    body: 'Dear {name}, {student_name} has been moved to {class} with effect from {date}. Please contact the class teacher for details.',
  },
  {
    id: 'data-update',
    name: 'Please verify the details',
    tag: 'Data update',
    subject: 'Please verify student details',
    body: 'Dear {name}, the school has updated the records of {student_name}. Please verify the details on the parent app by {date}.',
  },
];

export const UTILITY_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="utility.notice"
        title="Send utility notice"
        description="Tell parents a student was promoted to the next year, moved to another class, or that records were updated."
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
