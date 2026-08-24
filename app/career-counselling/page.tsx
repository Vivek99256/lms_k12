import { Suspense } from 'react';
import CareerCounselling from './CareerCounselling';

export default function CareerCounsellingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career counselling…</div>}>
      <CareerCounselling />
    </Suspense>
  );
}
