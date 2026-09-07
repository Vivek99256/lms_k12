import { Suspense } from 'react';
import { CareerAwarenessSectionHub } from '../_components/CareerAwarenessSectionHub';

export default function CareerAlignmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career alignment…</div>}>
      <CareerAwarenessSectionHub section="alignment" />
    </Suspense>
  );
}
