'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Catches a render error in any page so it replaces that page only — the shell,
 * menu and session stay up. Without this, one failing widget blanked the app.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        </div>
        <h1 className="mb-4 text-xl font-semibold text-gray-800">This page could not be displayed</h1>
        <p className="mb-8 text-gray-500">
          Something went wrong while loading this page. Your data has not been changed. Try again, or go back
          to the dashboard.
          {error.digest ? <span className="mt-2 block font-mono text-xs text-gray-400">Error code: {error.digest}</span> : null}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => reset()}
            className="h-11 rounded-xl border-gray-200 px-6 text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button onClick={() => (window.location.href = '/dashboard')} className="h-11 rounded-xl px-8 font-semibold">
            <Home className="mr-2 h-4 w-4" />
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
