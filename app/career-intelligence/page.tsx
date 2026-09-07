import { Suspense } from 'react';
import CareerIntelligenceHub from './CareerIntelligenceHub';

export default function CareerIntelligencePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career intelligence…</div>}>
      <CareerIntelligenceHub />
    </Suspense>
  );
}
