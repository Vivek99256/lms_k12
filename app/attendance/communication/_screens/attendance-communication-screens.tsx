'use client';

import { BellRing, History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { AttendanceBroadcastNotice } from '@/app/attendance/communication/_components/AttendanceBroadcastNotice';
import { AttendanceDeliveryLog } from '@/app/attendance/communication/_components/AttendanceDeliveryLog';
import { AttendanceNotificationSettings } from '@/app/attendance/communication/_components/AttendanceNotificationSettings';

/**
 * Attendance → Communication tabs.
 *
 * Provides dedicated communication tools for attendance management:
 * 1. Send notice: Multi-channel broadcast messages (SMS, WhatsApp, Email, Portal) for daily absence alerts, low attendance warnings, and register reminders.
 * 2. Delivery log: Audit log and dispatch metrics for every attendance notice sent.
 * 3. Notification settings: Automated triggers for daily student absences, threshold alerts, missing class registers, and student leave decisions.
 */
export const ATTENDANCE_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'send-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <AttendanceBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <AttendanceDeliveryLog />,
  },
  {
    id: 'notification-settings',
    label: 'Notification settings',
    icon: BellRing,
    render: () => <AttendanceNotificationSettings />,
  },
];

