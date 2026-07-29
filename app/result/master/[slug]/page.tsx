'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import MasterCrud from '@/components/result/MasterCrud';
import { EmptyState } from '@/components/result/primitives';
import { findMasterScreen } from '@/lib/result/masters';
import { readString } from '@/lib/result/api';

/**
 * All config-driven master screens share this route:
 * /result/master/hpc-activity, /result/master/exam-creation, …
 * (exam-master and grade-master have bespoke tabbed pages.)
 */
export default function MasterScreenPage() {
  const params = useParams();
  const slug = readString(params?.slug);
  const screen = findMasterScreen(slug);

  if (!screen) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={<FileQuestion />}
          title="Screen not found"
          message={`No master screen is registered for “${slug}”.`}
          action={
            <Link
              href="/result"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Back to Result module
            </Link>
          }
        />
      </div>
    );
  }

  return <MasterCrud key={screen.slug} screen={screen} />;
}
