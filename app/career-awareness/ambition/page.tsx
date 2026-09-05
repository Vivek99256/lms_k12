import { Suspense } from 'react';
import { CareerAwarenessSectionHub } from '../_components/CareerAwarenessSectionHub';

export default function CareerAmbitionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career ambition…</div>}>
      <CareerAwarenessSectionHub section="ambition" />
    </Suspense>
  );
}
