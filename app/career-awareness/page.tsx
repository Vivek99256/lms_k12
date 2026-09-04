import { Suspense } from 'react';
import CareerAwarenessHub from './CareerAwarenessHub';

export default function CareerAwarenessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career awareness…</div>}>
      <CareerAwarenessHub />
    </Suspense>
  );
}
