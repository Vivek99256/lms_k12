'use client';

import { History, Send } from 'lucide-react';
import type { ModuleStaticScreen } from '@/app/modules/_components/module-category-page';
import { ModuleBroadcastNotice, type NoticeTemplate } from '@/app/_components/module-notice/ModuleBroadcastNotice';
import { ModuleDeliveryLog } from '@/app/_components/module-notice/ModuleDeliveryLog';
import { TalentTheme } from '@/app/talent-management/_lib/talent-theme';

const MODULE_KEY = 'talent-management';

const FIELDS = {
  name: 'Person name',
  role: 'Role / job opening',
  date: 'Date',
  time: 'Time',
};

const TEMPLATES: NoticeTemplate[] = [
  {
    id: 'interview-invite',
    name: 'Interview invitation',
    tag: 'Recruitment',
    subject: 'Interview invitation',
    body: 'Dear {name}, you are invited to an interview for {role} on {date} at {time}. Please reply to confirm your availability.',
  },
  {
    id: 'interview-reminder',
    name: 'Interview reminder',
    tag: 'Recruitment',
    subject: 'Interview reminder',
    body: 'Dear {name}, a reminder that your interview for {role} is on {date} at {time}. Please arrive 10 minutes early.',
  },
  {
    id: 'offer-released',
    name: 'Offer released',
    tag: 'Recruitment',
    subject: 'Your offer is ready',
    body: 'Dear {name}, we are pleased to offer you the position of {role}. Please review and reply by {date}.',
  },
  {
    id: 'onboarding-welcome',
    name: 'Welcome and joining details',
    tag: 'Onboarding',
    subject: 'Welcome aboard',
    body: 'Dear {name}, welcome! You are joining as {role} on {date}. Please report at {time} with your documents.',
  },
  {
    id: 'review-reminder',
    name: 'Performance review reminder',
    tag: 'Performance',
    subject: 'Review due',
    body: 'Dear {name}, your {role} review is due on {date}. Please complete it before then.',
  },
  {
    id: 'exit-clearance',
    name: 'Exit clearance reminder',
    tag: 'Offboarding',
    subject: 'Exit clearance pending',
    body: 'Dear {name}, your clearance for {role} is still pending. Please complete it before your last working day on {date}.',
  },
];

export const TALENT_MANAGEMENT_COMMUNICATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'broadcast-notice',
    label: 'Send notice',
    icon: Send,
    render: () => (
      <TalentTheme>
        <ModuleBroadcastNotice
          moduleKey={MODULE_KEY}
          eventKey="talent-management.notice"
          title="Send talent notice"
          description="Invite candidates to interviews, send offers and joining details, remind people about reviews and exit clearance."
          templates={TEMPLATES}
          fields={FIELDS}
        />
      </TalentTheme>
    ),
  },
  {
    id: 'delivery-log',
    label: 'Delivery log',
    icon: History,
    render: () => (
      <TalentTheme>
        <ModuleDeliveryLog moduleKey={MODULE_KEY} />
      </TalentTheme>
    ),
  },
];
