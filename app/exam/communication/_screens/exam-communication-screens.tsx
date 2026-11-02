'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ExamBroadcastNotice } from '@/app/exam/communication/_components/ExamBroadcastNotice';
import { ExamDeliveryLog } from '@/app/exam/communication/_components/ExamDeliveryLog';

export const EXAM_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => <ExamBroadcastNotice />,
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => <ExamDeliveryLog />,
  },
];

