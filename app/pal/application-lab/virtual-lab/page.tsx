'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { VirtualLabRunner } from '@/app/pal/_components/virtual-lab/VirtualLabRunner';

/**
 * Deep link to a 3D virtual lab as a full page:
 *   /pal/application-lab/virtual-lab?chapter=8604&lab=dissolving
 * The journey opens the same runner as an overlay from the Application Lab step.
 */
function Page() {
  const params = useSearchParams();
  const chapter = params.get('chapter') ?? '8604';
  const lab = params.get('lab') ?? 'dissolving';
  return <VirtualLabRunner key={`${chapter}:${lab}`} chapterId={chapter} labId={lab} standalone />;
}

export default function VirtualLabPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
