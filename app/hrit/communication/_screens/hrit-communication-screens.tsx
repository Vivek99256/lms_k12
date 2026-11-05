'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { HritBroadcastNotice } from '@/app/hrit/communication/_components/HritBroadcastNotice';
import { HritDeliveryLog } from '@/app/hrit/communication/_components/HritDeliveryLog';

export const HRIT_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <HritBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <HritDeliveryLog />,
  },
];

