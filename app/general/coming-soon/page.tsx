'use client';

import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ComingSoonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleName = searchParams.get('module') || 'This Module';

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center justify-center text-center max-w-[1400px] bg-surface rounded-xl border border-dashed border-border p-8">
        <div className="p-4 bg-muted/50 rounded-full mb-4">
          <svg
            className="size-8 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{moduleName} Under Construction</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {moduleName} is currently being built. It will provide advanced configuration capabilities in a future update.
        </p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Return to dashboard
        </button>
      </div>
    </div>
  );
}
