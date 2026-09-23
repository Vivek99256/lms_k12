'use client';

import { FeesIntelligenceScreen } from '@/app/fees/intelligence/_components/fees-intelligence-screen';

/**
 * Fees → Intelligence.
 *
 * Renders the native Fees Intelligence workspace directly, matching the standard
 * module pattern. This eliminates the redundant top-level strip ("Fees Intelligence" + dot)
 * while preserving the module's hero card, analytics, and horizontal section navigation.
 */
export default function Page() {
  return <FeesIntelligenceScreen />;
}

