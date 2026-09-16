import { Suspense } from 'react';
import { KnowingYourselfHub } from './_components/KnowingYourselfHub';

export default function KnowingYourselfPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading your results…</div>}>
      <KnowingYourselfHub />
    </Suspense>
  );
}
