'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { appendCommonParams, buildSessionContext, createAuthHeaders, normalizeApiStatus, readString, type ApiEnvelope } from '@/lib/erp-client';
import { MobilePageRenderer, resolveActionBody, resolveActionEndpoint } from '@/components/mobile-page-builder/renderer/MobilePageRenderer';
import { MOBILE_CANVAS_WIDTH, type MobileAction, type MobilePageLayout } from '@/components/mobile-page-builder/shared/layoutTypes';

/**
 * What Flutter's WebView actually opens for a `page_source = 'custom'` menu
 * row -- a lightweight bootstrap page, same placement idiom as
 * app/mobile-bridge/page.tsx, not an admin screen under app/general/.
 *
 * By the time this loads, the mobile-bridge handoff has already populated
 * localStorage with a real session (see MobileWebHandoffApiController and
 * app/mobile-bridge/page.tsx) -- this page never does anything special for
 * auth, it just uses the SAME buildSessionContext()/proxy path every other
 * lms_k12 page already uses. Every data fetch and every button action goes
 * through /api/proxy with the viewer's own bearer token -- see
 * MobilePageBuilderAdminApiController's class doc for why that is enough to
 * make this safe without a new server-side execution surface.
 */

const K12_EMBED_AGENT = 'K12AppWebView';

function isEmbeddedInApp(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes(K12_EMBED_AGENT);
}

/** The JS channel DynamicWebScreen registers when this page is opened inside the K12 app's WebView (see dynamic_web_screen.dart's K12PageAction channel). Absent in an ordinary browser tab, e.g. an admin's Preview. */
function getPageActionChannel(): { postMessage: (message: string) => void } | undefined {
  return (window as unknown as { K12PageAction?: { postMessage: (message: string) => void } }).K12PageAction;
}

async function proxyRequest(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const session = buildSessionContext();
  if (!session.token || !session.subInstituteId) {
    throw new Error('Your session could not be found. Please reopen this page from the app.');
  }

  const params = new URLSearchParams();
  appendCommonParams(params, session);

  const response = await fetch(`/api/proxy?path=${encodeURIComponent(`api/${path}`)}&${params.toString()}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? 'application/json' : undefined),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json();
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  if (!response.ok || ['0', '2'].includes(normalizeApiStatus(record as ApiEnvelope))) {
    throw new Error(readString(record.message) || `Request failed (${response.status}).`);
  }
  return record;
}

export default function CustomMobilePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug ?? '';

  const [layout, setLayout] = useState<MobilePageLayout | null>(null);
  const [data, setData] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => setScale(Math.min(1, window.innerWidth / MOBILE_CANVAS_WIDTH));
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const runtime = await proxyRequest(`mobile-page-builder/runtime/${encodeURIComponent(slug)}`);
      const runtimeData = runtime.data as Record<string, unknown> | undefined;
      const pageLayout = runtimeData?.layout as MobilePageLayout | undefined;
      if (!pageLayout) throw new Error('This page is not available.');
      setLayout(pageLayout);

      const endpoint = pageLayout.page.dataSource?.endpoint;
      if (endpoint) {
        try {
          const dataResponse = await proxyRequest(endpoint);
          setData(dataResponse.data ?? dataResponse);
        } catch {
          // A missing/unauthorized data source should not blank the whole
          // page -- static content and unbound fields still render.
          setData(undefined);
        }
      }
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'This page is not available.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const goBack = useCallback(() => {
    const channel = isEmbeddedInApp() ? getPageActionChannel() : undefined;
    if (channel) {
      channel.postMessage(JSON.stringify({ action: 'close' }));
      return;
    }
    router.back();
  }, [router]);

  const navigateTo = useCallback(
    (target: MobileAction['navigate']) => {
      if (!target) return;
      if (target.kind === 'back') {
        goBack();
        return;
      }
      router.push(`/mobile/custom/${target.slug}`);
    },
    [router, goBack]
  );

  const handleAction = useCallback(
    async (action: MobileAction, formValues: Record<string, string>) => {
      if (action.type === 'navigate') {
        navigateTo(action.navigate);
        return;
      }

      if (action.type !== 'api') return;

      try {
        const body = resolveActionBody(action, formValues);
        await proxyRequest(resolveActionEndpoint(action, formValues), {
          method: action.method || 'POST',
          body: JSON.stringify(body),
        });
        setBanner({ tone: 'success', text: action.successMessage || 'Saved.' });

        if (action.onSuccess?.type === 'reload') void load();
        else if (action.onSuccess?.type === 'goBack') goBack();
        else if (action.onSuccess?.type === 'navigate') navigateTo(action.onSuccess.target);
      } catch (actionError: unknown) {
        setBanner({
          tone: 'error',
          text: action.errorMessage || (actionError instanceof Error ? actionError.message : 'Something went wrong.'),
        });
      }
    },
    [navigateTo, goBack, load]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !layout) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <AlertCircle className="size-8 text-slate-400" />
          <p className="text-sm text-slate-500">{error || 'This page is not available.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {banner ? (
        <div className={`px-4 py-2 text-center text-sm ${banner.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {banner.text}
        </div>
      ) : null}
      <div className="flex justify-center">
        <MobilePageRenderer layout={layout} data={data} onAction={handleAction} scale={scale} />
      </div>
    </div>
  );
}
