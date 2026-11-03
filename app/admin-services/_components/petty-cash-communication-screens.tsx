'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'petty-cash';

const FIELDS = {
  name: 'Recipient name',
  amount: 'Amount (Rs.)',
  date: 'Date',
  reference: 'Reference / head',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'expense-recorded',
    name: 'Expense recorded',
    tag: 'Entry',
    subject: 'Petty cash expense recorded',
    body: 'Dear {name}, a petty cash expense of Rs. {amount} dated {date} has been recorded against {reference}.',
  },
  {
    id: 'bill-pending',
    name: 'Bill pending reminder',
    tag: 'Reminder',
    subject: 'Petty cash bill pending',
    body: 'Dear {name}, please submit the bill for the petty cash expense of Rs. {amount} dated {date} ({reference}) to the accounts office.',
  },
  {
    id: 'reimbursed',
    name: 'Amount reimbursed',
    tag: 'Reimbursement',
    subject: 'Petty cash reimbursed',
    body: 'Dear {name}, Rs. {amount} has been reimbursed on {date} against {reference}.',
  },
];

export const PETTY_CASH_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="petty-cash.notice"
        title="Send petty cash notice"
        description="Tell a staff member that a petty cash expense was recorded, a bill is pending or an amount was reimbursed."
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
