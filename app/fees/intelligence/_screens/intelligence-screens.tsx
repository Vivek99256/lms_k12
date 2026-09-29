'use client';

import { Brain } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { ModuleIntelligence } from '@/components/intelligence/module/ModuleIntelligence';
import { feesIntelligenceContract } from '@/components/intelligence/module/contracts/fees';

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
 * NOTHING ELSE ABOUT FEES NAVIGATION MOVES. ModuleCategoryPage still renders this
 * as the first tab and still appends every Intelligence menu the user has
 * rights to from the database ("Fees Prediction" today), so no working screen
 * is hidden by this one.
 */

export const FEES_INTELLIGENCE_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'fees-intelligence',
    label: 'Fees Intelligence',
    icon: Brain,
    /*
     * FEES NOW RENDERS THROUGH THE SHARED RENDERER, like every other module.
     *
     * It was the last screen on the old native renderer: one long vertical page
     * of nine stacked sections, with no section nav, no Module Integration and
     * no Cross-Module Workflow. That made the product's reference implementation
     * the one screen that did not follow the product's own Intelligence UX.
     *
     * NOTHING ABOUT THE NUMBERS MOVES. `feesIntelligenceContract` loads the same
     * `/fees/intelligence` endpoint through the same client and adapts the same
     * payload — every figure is still computed by BrainFeesIntelligenceController
     * over the same fee records. Cancellations and refunds, the one block the
     * contract did not previously carry, are mapped into the position metrics so
     * no figure is lost in the move.
     *
     * `fees-intelligence-screen.tsx` is deliberately left on disk rather than
     * deleted: it is the reference for what this screen used to show, and
     * removing 1,690 lines is a separate decision from changing which one runs.
     */
    render: () => <ModuleIntelligence contract={feesIntelligenceContract} />,
  },
];
