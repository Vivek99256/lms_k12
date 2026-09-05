'use client';

import { BellRing, FileText, Megaphone, Radio, Send, SlidersHorizontal } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';

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
    id: 'templates',
    label: 'Templates',
    icon: FileText,
    render: () => (
      <FeesPlaceholderScreen
        title="Templates"
        summary="Reusable message bodies for fees notices and reminders."
        points={[
          'Templates per channel, with the fee fields they can merge in.',
          'A preview rendered against a real student before sending.',
          'Versions, so a template in use is not changed underneath a campaign.',
        ]}
      />
    ),
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: Megaphone,
    render: () => (
      <FeesPlaceholderScreen
        title="Campaigns"
        summary="One-off sends to a chosen group of parents or students."
        points={[
          'Audience built from fees criteria such as outstanding amount or class.',
          'Scheduling, with an approval step before anything leaves.',
          'Results per campaign once it has run.',
        ]}
      />
    ),
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: BellRing,
    render: () => (
      <FeesPlaceholderScreen
        title="Reminders"
        summary="Recurring nudges for fees that are due or overdue."
        points={[
          'Schedules relative to a due date — before, on, and after.',
          'Escalation as an amount stays unpaid.',
          'Suppression rules so a paid-up family is never chased.',
        ]}
      />
    ),
  },
  {
    id: 'channels',
    label: 'Channels',
    icon: Radio,
    render: () => (
      <FeesPlaceholderScreen
        title="Channels"
        summary="The delivery routes available to Fees, and their state."
        points={[
          'SMS, email, WhatsApp and in-app, with whether each is configured.',
          'Per-channel sending limits and quiet hours.',
          'Fallback order when the first channel cannot deliver.',
        ]}
      />
    ),
  },
  {
    id: 'delivery-log',
    label: 'Delivery Log',
    icon: Send,
    render: () => (
      <FeesPlaceholderScreen
        title="Delivery Log"
        summary="Every fees message sent, and what happened to it."
        points={[
          'Recipient, channel, template and timestamp per message.',
          'Delivery state, including failures and the reason.',
          'Filter by campaign, student or date range.',
        ]}
      />
    ),
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: SlidersHorizontal,
    render: () => (
      <FeesPlaceholderScreen
        title="Preferences"
        summary="How and when Fees is allowed to contact a family."
        points={[
          'Per-family channel choices and opt-outs.',
          'Language preference for fees messages.',
          'Institute-wide defaults for families that have set nothing.',
        ]}
      />
    ),
  },
];
