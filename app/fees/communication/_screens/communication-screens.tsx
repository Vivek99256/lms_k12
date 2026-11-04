'use client';

import { BellRing, History, Send } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { FeesBroadcastNotice } from '@/app/fees/communication/_components/FeesBroadcastNotice';
import { FeesDeliveryLog } from '@/app/fees/communication/_components/FeesDeliveryLog';
import { FeesNotificationSettings } from '@/app/fees/communication/_components/FeesNotificationSettings';

export const FEES_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <FeesBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <FeesDeliveryLog />,
  },
  {
    id: 'notification-settings',
    label: 'Notification settings',
    icon: BellRing,
    render: () => <FeesNotificationSettings />,
  },
];
