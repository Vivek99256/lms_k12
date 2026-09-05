import { Suspense } from 'react';
import CollegeProfileHub from './CollegeProfileHub';

export default function CollegeProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading colleges…</div>}>
      <CollegeProfileHub />
    </Suspense>
  );
}
