import { Suspense } from 'react';
import { InterestProfileHub } from './_components/InterestProfileHub';

export default function InterestProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading interest profile…</div>}>
      <InterestProfileHub />
    </Suspense>
  );
}
