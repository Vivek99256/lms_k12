import { Suspense } from 'react';
import CareerExplorerHub from './CareerExplorerHub';

export default function CareerExplorerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading career explorer…</div>}>
      <CareerExplorerHub />
    </Suspense>
  );
}
