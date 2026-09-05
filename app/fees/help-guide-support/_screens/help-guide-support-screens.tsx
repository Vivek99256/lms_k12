'use client';

import { BookOpen, LifeBuoy, MessageSquareWarning, PlayCircle, Rocket, ScrollText } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';

/**
 * Fees → Help Guide / Support tabs.
 *
 * Scaffolding for the module's documentation and support surface. No guides,
 * articles or tickets exist behind these yet, so each tab renders the shared
 * placeholder rather than showing an empty list that looks broken.
 */
export const FEES_HELP_SUPPORT_SCREENS: FeesStaticScreen[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Rocket,
    render: () => (
      <FeesPlaceholderScreen
        title="Getting Started"
        summary="A short orientation to the Fees module for someone using it for the first time."
        points={[
          'What each Fees category is for, and when to use it.',
          'The everyday path: collect, cancel, reconcile, report.',
          'Where to go next depending on the role.',
        ]}
      />
    ),
  },
  {
    id: 'user-guides',
    label: 'User Guides',
    icon: BookOpen,
    render: () => (
      <FeesPlaceholderScreen
        title="User Guides"
        summary="Step-by-step instructions for each Fees screen."
        points={[
          'Guides grouped by category, matching the tabs in the module.',
          'Search across all Fees documentation.',
          'Guides marked for the roles they apply to.',
        ]}
      />
    ),
  },
  {
    id: 'faqs',
    label: 'FAQs',
    icon: MessageSquareWarning,
    render: () => (
      <FeesPlaceholderScreen
        title="FAQs"
        summary="Answers to the questions the fees desk gets most often."
        points={[
          'Common collection, cancellation and reconciliation questions.',
          'Explanations of the errors people hit most.',
          'Links through to the full guide for each answer.',
        ]}
      />
    ),
  },
  {
    id: 'video-tutorials',
    label: 'Video Tutorials',
    icon: PlayCircle,
    render: () => (
      <FeesPlaceholderScreen
        title="Video Tutorials"
        summary="Short recordings of the common Fees tasks."
        points={[
          'Walkthroughs of collection, cancellation and month-end.',
          'Grouped by category and length.',
          'Progress kept, so a part-watched video can be resumed.',
        ]}
      />
    ),
  },
  {
    id: 'release-notes',
    label: 'Release Notes',
    icon: ScrollText,
    render: () => (
      <FeesPlaceholderScreen
        title="Release Notes"
        summary="What has changed in the Fees module, newest first."
        points={[
          'New screens, changed behaviour and fixes per release.',
          'Anything that needs action from an administrator.',
          'The version currently running for this institute.',
        ]}
      />
    ),
  },
  {
    id: 'raise-a-ticket',
    label: 'Raise a Ticket',
    icon: LifeBuoy,
    render: () => (
      <FeesPlaceholderScreen
        title="Raise a Ticket"
        summary="Report a Fees problem and follow it through to a fix."
        points={[
          'A form that captures the screen and context automatically.',
          'Existing tickets with their status and last update.',
          'The conversation history on each ticket.',
        ]}
      />
    ),
  },
];
