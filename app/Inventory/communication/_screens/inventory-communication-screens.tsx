'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'inventory';

const FIELDS = {
  name: 'Recipient name',
  requisition_no: 'Requisition / PO no.',
  item: 'Item',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'requisition-approved',
    name: 'Requisition approved',
    tag: 'Requisition',
    subject: 'Requisition approved',
    body: 'Dear {name}, your requisition {requisition_no} for {item} has been approved on {date}.',
  },
  {
    id: 'requisition-rejected',
    name: 'Requisition rejected or on hold',
    tag: 'Requisition',
    subject: 'Requisition not approved',
    body: 'Dear {name}, your requisition {requisition_no} for {item} could not be approved on {date}. Please contact the store for details.',
  },
  {
    id: 'item-ready',
    name: 'Item ready for collection',
    tag: 'Issue',
    subject: 'Item ready for collection',
    body: 'Dear {name}, {item} against requisition {requisition_no} is ready for collection from the store from {date}.',
  },
  {
    id: 'po-vendor',
    name: 'Purchase order to vendor',
    tag: 'Purchase',
    subject: 'Purchase order issued',
    body: 'Dear {name}, purchase order {requisition_no} for {item} has been issued on {date}. Please confirm the delivery schedule.',
  },
];

export const INVENTORY_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="inventory.notice"
        title="Send inventory notice"
        description="Tell staff or a vendor about a requisition decision, an item ready for collection, or a purchase order."
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
