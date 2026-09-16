'use client';

import { Brain } from 'lucide-react';

import type { FeesStaticScreen } from '@/app/fees/_components/fees-category-page';
import { FeesIntelligenceScreen } from '@/app/fees/intelligence/_components/fees-intelligence-screen';

/**
 * The Fees → Intelligence workspace.
 *
 * WHAT CHANGED, AND WHY IT IS THE WHOLE CHANGE. This file used to declare eight
 * static placeholder tabs — Data Injection, Overview, AI Agents, Action Items,
 * Module Integration, Cross-Module Workflows, Recommendations, Decision Record
 * — each describing a screen that did not exist. They are replaced by one tab
 * that exists: a native Fees Intelligence experience reading this institute's
 * real fee records for the academic year the LMS header has selected.
 *
 * The concepts those eight tabs named are not lost; they were never separate
 * products. Recommendations, Decision Record and Outcome are stages of one
 * loop and now appear as sections of it, with the data that makes them true.
 * The tabs that named capabilities this system genuinely does not have — an
 * agent roster, an ingestion console — are gone rather than reproduced as
 * convincing empty shells.
 *
 * NOTHING ELSE ABOUT FEES NAVIGATION MOVES. FeesCategoryPage still renders this
 * as the first tab and still appends every Intelligence menu the user has
 * rights to from the database ("Fees Prediction" today), so no working screen
 * is hidden by this one.
 */

export const FEES_INTELLIGENCE_SCREENS: FeesStaticScreen[] = [
  {
    id: 'fees-intelligence',
    label: 'Fees Intelligence',
    icon: Brain,
    render: () => <FeesIntelligenceScreen />,
  },
];
