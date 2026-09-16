'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Modules that used to live on this stub and now have a real screen.
 *
 * The menu no longer points here for these — Header.tsx and routeMapper.ts both
 * resolve them to their own routes — but a bookmark, a saved link or a
 * `tblmenumaster` row that has not been updated still can. Redirecting means
 * those keep working instead of showing "under construction" for something that
 * has shipped.
 *
 * Keyed lowercase; the query string carries the display name ("Document").
 */
const GRADUATED_MODULES: Record<string, string> = {
  document: '/documents',
  // Event Bus is a monitoring plane over the outbox, audit tables and send-logs
  // that already run — not an event bus, which this product does not have. It
  // lives beside the other Platform Services consoles.
  'event bus': '/platform-services/event-bus',
};

export default function ComingSoonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleName = searchParams.get('module') || 'This Module';

  const graduatedRoute = GRADUATED_MODULES[moduleName.trim().toLowerCase()];

  useEffect(() => {
    // replace(), not push(): the stub should not sit in history behind the real
    // screen, or Back from the module lands here and bounces forward again.
    if (graduatedRoute) router.replace(graduatedRoute);
  }, [graduatedRoute, router]);

  if (graduatedRoute) return null;

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
