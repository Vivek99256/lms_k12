'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';

const MODULE_KEY = 'transport';

const FIELDS = {
  name: 'Parent name',
  student_name: 'Student name',
  route: 'Route / vehicle',
  stop: 'Stop',
  time: 'Time',
  date: 'Date',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'transport-assigned',
    name: 'Transport assigned',
    tag: 'Allocation',
    subject: 'School transport assigned',
    body: 'Dear {name}, {student_name} has been assigned to {route}. Pick-up stop: {stop} at {time}. Applicable from {date}.',
  },
  {
    id: 'transport-delay',
    name: 'Bus delay notice',
    tag: 'Delay',
    subject: 'School bus delayed',
    body: 'Dear {name}, {route} is running late today ({date}). The expected arrival at {stop} is now around {time}. Sorry for the inconvenience.',
  },
  {
    id: 'transport-change',
    name: 'Route or timing change',
    tag: 'Change',
    subject: 'Transport change',
    body: 'Dear {name}, from {date} the transport for {student_name} will run on {route} with pick-up at {stop} at {time}.',
  },
];

export const TRANSPORT_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <ModuleBroadcastNotice
        moduleKey={MODULE_KEY}
        eventKey="transport.notice"
        title="Send transport notice"
        description="Tell parents about an assigned bus, a delay, or a change of route or timing."
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
