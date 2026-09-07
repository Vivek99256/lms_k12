import { Suspense } from 'react';
import EmployerProfileHub from './EmployerProfileHub';

export default function EmployerProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading employers…</div>}>
      <EmployerProfileHub />
    </Suspense>
  );
}
