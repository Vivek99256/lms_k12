'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'task-management';

const FIELDS = {
  name: 'Assignee name',
  task: 'Task',
  project: 'Project',
  date: 'Due date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'task-assigned',
    name: 'Task assigned',
    tag: 'Assignment',
    subject: 'New task assigned',
    body: 'Dear {name}, the task "{task}" in project {project} has been assigned to you and is due on {date}. Please review it and update the status.',
  },
  {
    id: 'task-due',
    name: 'Due date reminder',
    tag: 'Reminder',
    subject: 'Task due soon',
    body: 'Dear {name}, a reminder that "{task}" ({project}) is due on {date}. Please complete it or update its status before then.',
  },
  {
    id: 'task-overdue',
    name: 'Overdue task notice',
    tag: 'Overdue',
    subject: 'Task overdue',
    body: 'Dear {name}, the task "{task}" ({project}) was due on {date} and is still open. Please complete it today or tell your reviewer what is blocking it.',
  },
  {
    id: 'task-rejected',
    name: 'Rework requested',
    tag: 'Review',
    subject: 'Task needs rework',
    body: 'Dear {name}, your submission for "{task}" ({project}) needs changes. Please revisit it and resubmit by {date}.',
  },
];

export const TASK_MANAGEMENT_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="task-management.notice"
        title="Send task notice"
        description="Tell people about a new assignment, remind them of a due date, chase an overdue task or ask for rework."
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
