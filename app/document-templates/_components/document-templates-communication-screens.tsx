'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'document-templates';

const FIELDS = {
  name: 'Parent name',
  student_name: 'Student name',
  document: 'Document',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'document-ready',
    name: 'Document ready for collection',
    tag: 'Certificate',
    subject: 'Document ready',
    body: 'Dear {name}, the {document} for {student_name} is ready. Please collect it from the school office from {date}.',
  },
  {
    id: 'id-card-ready',
    name: 'ID card issued',
    tag: 'ID card',
    subject: 'ID card issued',
    body: 'Dear {name}, the school ID card for {student_name} has been issued on {date}. Please collect it from the class teacher.',
  },
  {
    id: 'fee-document',
    name: 'Fee statement available',
    tag: 'Fees',
    subject: 'Fee document available',
    body: 'Dear {name}, the {document} for {student_name} is available from {date}. Please contact the accounts office if you need a copy.',
  },
];

export const DOCUMENT_TEMPLATES_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="document-templates.notice"
        title="Send document notice"
        description="Tell parents a certificate, ID card or fee document is ready."
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
