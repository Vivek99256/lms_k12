'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { MobileAppsBroadcastNotice } from '@/app/mobile-apps/communication/_components/MobileAppsBroadcastNotice';
import { MobileAppsDeliveryLog } from '@/app/mobile-apps/communication/_components/MobileAppsDeliveryLog';

export const MOBILE_APPS_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <MobileAppsBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <MobileAppsDeliveryLog />,
  },
];

