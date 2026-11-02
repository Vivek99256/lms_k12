'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'consent';

const FIELDS = {
  name: 'Parent name',
  student_name: 'Student name',
  title: 'Consent title',
  amount: 'Amount (Rs.)',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'consent-request',
    name: 'Consent request',
    tag: 'Request',
    subject: 'Parent consent requested',
    body: 'Dear {name}, your consent is requested for {student_name} regarding "{title}". Please confirm with the class teacher by {date}.',
  },
  {
    id: 'consent-accountable',
    name: 'Accountable consent with amount',
    tag: 'Accountable',
    subject: 'Consent with amount',
    body: 'Dear {name}, consent for "{title}" for {student_name} carries an amount of Rs. {amount}. Please confirm by {date}.',
  },
  {
    id: 'consent-recorded',
    name: 'Consent recorded',
    tag: 'Recorded',
    subject: 'Consent recorded',
    body: 'Dear {name}, the school has recorded your consent for "{title}" for {student_name} on {date}. Thank you.',
  },
];

export const CONSENT_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="consent.notice"
        title="Send consent notice"
        description="Ask a parent for consent, or confirm that a consent has been recorded."
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
