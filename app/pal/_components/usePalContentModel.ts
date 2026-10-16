'use client';

import { useEffect, useState } from 'react';
import { buildSessionContext } from '@/lib/erp-client';
import type { PalContentModelResponse } from '@/app/pal/data/pal-content-model';

/**
 * Loads the PAL content model in the browser, where the login token lives.
 *
 * The ERP's api_guard now refuses semantic-intelligence without a bearer token,
 * and a server component has no session to send one from - so the token goes to
 * /api/pal/content-model, which forwards it to the ERP.
 */
export function usePalContentModel(chapterId?: string, concept?: string): PalContentModelResponse | null {
  const [model, setModel] = useState<PalContentModelResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (chapterId) query.set('chapterId', chapterId);
    if (concept) query.set('concept', concept);
    const qs = query.toString();
    const { token } = buildSessionContext();

    setModel(null);
    void (async () => {
      try {
        const res = await fetch(`/api/pal/content-model${qs ? `?${qs}` : ''}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = (await res.json().catch(() => null)) as PalContentModelResponse | null;
        if (controller.signal.aborted) return;
        setModel(
          payload ?? {
            context: null,
            frameworkModules: {} as PalContentModelResponse['frameworkModules'],
            uluModules: {} as PalContentModelResponse['uluModules'],
            error: 'We couldn’t load the content structure. Please try again.',
            isReady: false,
          },
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setModel({
          context: null,
          frameworkModules: {} as PalContentModelResponse['frameworkModules'],
          uluModules: {} as PalContentModelResponse['uluModules'],
          error: error instanceof Error ? error.message : 'We couldn’t load the content structure. Please try again.',
          isReady: false,
        });
      }
    })();

    return () => controller.abort();
  }, [chapterId, concept]);

  return model;
}
