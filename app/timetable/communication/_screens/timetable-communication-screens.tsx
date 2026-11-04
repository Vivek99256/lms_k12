'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { TimetableBroadcastNotice } from '@/app/timetable/communication/_components/TimetableBroadcastNotice';
import { TimetableDeliveryLog } from '@/app/timetable/communication/_components/TimetableDeliveryLog';

export const TIMETABLE_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <TimetableBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <TimetableDeliveryLog />,
  },
];

