'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { TeachLearnBroadcastNotice } from '@/app/teach-learn/communication/_components/TeachLearnBroadcastNotice';
import { TeachLearnDeliveryLog } from '@/app/teach-learn/communication/_components/TeachLearnDeliveryLog';

export const TEACH_LEARN_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <TeachLearnBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <TeachLearnDeliveryLog />,
  },
];

