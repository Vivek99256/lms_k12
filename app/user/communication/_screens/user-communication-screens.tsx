'use client';

import { BellRing, History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { UserBroadcastNotice } from '@/app/user/communication/_components/UserBroadcastNotice';
import { UserDeliveryLog } from '@/app/user/communication/_components/UserDeliveryLog';
import { UserNotificationSettings } from '@/app/user/communication/_components/UserNotificationSettings';

/**
 * Users & User I-Card → Communication tabs.
 *
 * Provides dedicated communication tools for school staff & users:
 * 1. Send notice: Multi-channel broadcast messages (SMS, WhatsApp, Email, Portal) to teachers, staff, and departments.
 * 2. Delivery log: Audit log and dispatch metrics for every staff communication sent.
 * 3. Notification settings: Automated triggers for staff ID cards, credentials, leave decisions, and payroll alerts.
 */
export const USER_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'send-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <UserBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <UserDeliveryLog />,
  },
  {
    id: 'notification-settings',
    label: 'Notification settings',
    icon: BellRing,
    render: () => <UserNotificationSettings />,
  },
];

