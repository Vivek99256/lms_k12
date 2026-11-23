'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { LabStudio } from '@/app/pal/_components/lab-studio/LabStudio';

/**
 * Lab Studio for teachers and admins:  /pal/lab-studio?chapter=8592
 * The server refuses every request from a student session; this page only asks.
 */
function Page() {
  const params = useSearchParams();
  return <LabStudio initialChapter={params.get('chapter') ?? ''} />;
}

export default function LabStudioPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
