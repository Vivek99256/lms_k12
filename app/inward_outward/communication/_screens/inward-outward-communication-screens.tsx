'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'inward-outward';

const FIELDS = {
  name: 'Recipient name',
  reference_no: 'Reference / entry no.',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'inward-received',
    name: 'Inward received acknowledgement',
    tag: 'Inward',
    subject: 'Inward received',
    body: 'Dear {name}, we have received your letter/parcel (Ref: {reference_no}) on {date}. It has been recorded in the school inward register.',
  },
  {
    id: 'outward-dispatched',
    name: 'Outward dispatched intimation',
    tag: 'Outward',
    subject: 'Outward dispatched',
    body: 'Dear {name}, the school has dispatched the document/parcel (Ref: {reference_no}) on {date}. Please contact the school office if it is not received.',
  },
  {
    id: 'collect-document',
    name: 'Collect document from office',
    tag: 'Reminder',
    subject: 'Document ready for collection',
    body: 'Dear {name}, the document with Ref: {reference_no} is ready for collection at the school office. Please collect it on or after {date}.',
  },
];

export const INWARD_OUTWARD_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="inward-outward.notice"
        title="Send inward / outward notice"
        description="Tell a sender or recipient that a letter, parcel or document was received, dispatched or is ready to collect."
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
