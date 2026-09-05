import { Suspense } from 'react';
import { CareerAwarenessSectionHub } from '../_components/CareerAwarenessSectionHub';

export default function CareerOriginalityPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career originality…</div>}>
      <CareerAwarenessSectionHub section="originality" />
    </Suspense>
  );
}
