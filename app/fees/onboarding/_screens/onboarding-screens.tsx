'use client';

import { ClipboardCheck, Rocket, Settings2, Table2, Upload, Wallet } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesPlaceholderScreen } from '@/app/fees/_components/fees-placeholder-screen';

/**
 * Fees → Onboarding tabs.
 *
 * Scaffolding: these six tabs describe the intended shape of getting a new
 * institute or academic year ready to collect fees. None of them is built yet,
 * so each renders the shared placeholder rather than fabricating a working
 * screen. They are declared in code, not in fees_menu_category_items, because
 * that table references real tblmenumaster rows and there is nothing real to
 * reference until these exist.
 */
export const FEES_ONBOARDING_SCREENS: FeesStaticScreen[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: Rocket,
    render: () => (
      <FeesPlaceholderScreen
        title="Getting Started"
        summary="The guided path from a blank institute to collecting its first receipt."
        points={[
          'Ordered steps with the ones already done marked off.',
          'What each step needs before it can be started.',
          'Where to pick up if setup was left part-finished.',
        ]}
      />
    ),
  },
  {
    id: 'institute-setup',
    label: 'Institute Setup',
    icon: Settings2,
    render: () => (
      <FeesPlaceholderScreen
        title="Institute Setup"
        summary="The institute-level details every fees screen depends on."
        points={[
          'Institute profile, currency and receipt numbering.',
          'Bank accounts and payment gateways available for collection.',
          'Roles allowed to collect, cancel and refund.',
        ]}
      />
    ),
  },
  {
    id: 'academic-year',
    label: 'Academic Year',
    icon: Table2,
    render: () => (
      <FeesPlaceholderScreen
        title="Academic Year"
        summary="Open a new academic year for fees and carry forward what should follow."
        points={[
          'Year and term definitions with their collection windows.',
          'Carry-forward of structures, break-offs and outstanding balances.',
          'Checks that flag anything the previous year left unclosed.',
        ]}
      />
    ),
  },
  {
    id: 'fee-structure',
    label: 'Fee Structure',
    icon: Wallet,
    render: () => (
      <FeesPlaceholderScreen
        title="Fee Structure"
        summary="Build the first fee structure for the year before collection opens."
        points={[
          'Heads, amounts and instalments per class or category.',
          'Concessions, late fees and the rules that apply them.',
          'A preview of what a student will actually be billed.',
        ]}
      />
    ),
  },
  {
    id: 'data-import',
    label: 'Data Import',
    icon: Upload,
    render: () => (
      <FeesPlaceholderScreen
        title="Data Import"
        summary="Bring existing fees data in from spreadsheets or a previous system."
        points={[
          'Templates for students, structures and opening balances.',
          'Validation before anything is written, with row-level errors.',
          'Import history, and the ability to reverse a bad run.',
        ]}
      />
    ),
  },
  {
    id: 'go-live',
    label: 'Go Live Checklist',
    icon: ClipboardCheck,
    render: () => (
      <FeesPlaceholderScreen
        title="Go Live Checklist"
        summary="The final confirmation that fees collection is safe to switch on."
        points={[
          'Every prerequisite with a pass or fail state.',
          'Blocking problems separated from advisory warnings.',
          'Who signed off, and when collection was opened.',
        ]}
      />
    ),
  },
];
