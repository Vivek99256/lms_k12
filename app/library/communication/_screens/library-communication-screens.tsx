'use client';

import { BellRing, History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { LibraryBroadcastNotice } from '@/app/library/communication/_components/LibraryBroadcastNotice';
import { LibraryDeliveryLog } from '@/app/library/communication/_components/LibraryDeliveryLog';
import { LibraryNotificationSettings } from '@/app/library/communication/_components/LibraryNotificationSettings';

/**
 * Library → Communication tabs.
 *
 * Provides dedicated communication tools for library management:
 * 1. Send notice: Multi-channel broadcast notices (SMS, WhatsApp, Email, Portal) for library announcements, book returns, and fine advisories.
 * 2. Delivery log: Audit log and dispatch metrics for every library dispatch.
 * 3. Notification settings: Automated triggers for book due dates, overdue returns, fines, and catalogue discrepancies.
 */
export const LIBRARY_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'send-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <LibraryBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <LibraryDeliveryLog />,
  },
  {
    id: 'notification-settings',
    label: 'Notification settings',
    icon: BellRing,
    render: () => <LibraryNotificationSettings />,
  },
];

