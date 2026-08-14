'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Orbit } from 'lucide-react';

const PAL_CONTEXT_STORAGE_KEY = 'palLastConceptContext';

interface StoredPalContext {
  chapterId?: string;
  concept?: string;
}

export function persistPalConceptContext(context: StoredPalContext) {
  if (typeof window === 'undefined') return;
  const chapterId = (context.chapterId || '').trim();
  if (!chapterId) return;

  const payload = {
    chapterId,
    concept: (context.concept || '0').trim() || '0',
  };

  window.sessionStorage.setItem(PAL_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
}

export default function PalContextBootstrap({
  targetPath,
}: {
  targetPath: '/pal/frameworks' | '/pal/ulu';
}) {
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PAL_CONTEXT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPalContext;
      const chapterId = (parsed.chapterId || '').trim();
      const concept = (parsed.concept || '0').trim() || '0';
      if (!chapterId) return;

      const query = new URLSearchParams({
        chapterId,
        concept,
      });
      router.replace(`${targetPath}?${query.toString()}`);
    } catch {
      // Ignore malformed session state and keep the empty fallback visible.
    }
  }, [router, targetPath]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600">
              <Orbit className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Loading PAL context</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                We&apos;re reconnecting New PAL to the latest Concept Intelligence chapter and concept.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Restoring last semantic context
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
