'use client';

import { BellRing } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesNotificationSettings } from '@/app/fees/communication/_components/FeesNotificationSettings';

/**
 * Fees → Communication tabs.
 *
 * Scaffolding for fees notices, reminders and parent communication. Nothing
 * here sends anything yet, and nothing is wired to the existing Fees Circular
 * screen (which lives under Operations and stays there) or to the institute's
 * SMS/email settings. Each tab renders the shared placeholder.
 */
export const FEES_COMMUNICATION_SCREENS: FeesStaticScreen[] = [
  {
    id: 'notification-settings',
    label: 'Notification Settings',
    icon: BellRing,
    render: () => <FeesNotificationSettings />,
  },
];
