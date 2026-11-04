'use client';

import { BellRing, History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { AdmissionBroadcastNotice } from '@/app/admissions/communication/_components/AdmissionBroadcastNotice';
import { AdmissionDeliveryLog } from '@/app/admissions/communication/_components/AdmissionDeliveryLog';
import { AdmissionNotificationSettings } from '@/app/admissions/communication/_components/AdmissionNotificationSettings';

/**
 * Admissions → Communication tabs.
 *
 * Provides dedicated communication tools for school admissions:
 * 1. Send notice: Multi-channel broadcast messages (SMS, WhatsApp, Email) to applicants, enquiries, and parents.
 * 2. Delivery log: Audit log and dispatch metrics for every admission communication sent.
 * 3. Notification settings: Automated triggers for enquiries, applications, interviews, and enrollment.
 */
export const ADMISSION_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'send-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <AdmissionBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <AdmissionDeliveryLog />,
  },
  {
    id: 'notification-settings',
    label: 'Notification settings',
    icon: BellRing,
    render: () => <AdmissionNotificationSettings />,
  },
];

