import { Suspense } from 'react';
import { CareerAwarenessSectionHub } from '../_components/CareerAwarenessSectionHub';

export default function CareerCertaintyPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career certainty…</div>}>
      <CareerAwarenessSectionHub section="certainty" />
    </Suspense>
  );
}
