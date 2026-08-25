'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import {
  fetchFlowState,
  fetchWorkspaceContext,
  type Capability,
  type FlowState,
  type WorkspacePayload,
  type WorkspaceSession,
} from '@/lib/intelligence/workspace';

/**
 * Resolves the AI Workspace for wherever the user currently is.
 *
 * The route comes from `usePathname()`, which is the same value the existing chat
 * already sends as `context.route` — so context-awareness reuses a signal the panel
 * was passing all along rather than introducing a parallel one.
 *
 * Re-resolves on navigation, so walking from a student page to the fees list swaps the
 * suggestions without the user reopening the panel. Requests are sequenced: a slow
 * reply for a route the user has already left is discarded rather than overwriting
 * the current one.
 */

const SESSION_KEYS = { user: 'userData', menu: 'menuContext', year: 'selectedAcademicYear' };

function readSession(): WorkspaceSession {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const userData = JSON.parse(localStorage.getItem(SESSION_KEYS.user) || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem(SESSION_KEYS.menu) || '{}') as Record<string, unknown>;

    return {
      token: String(
        userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token ?? ''
      ),
      baseUrl: String(userData.host_name ?? ''),
      instituteId: String(userData.sub_institute_id ?? menuContext.sub_institute_id ?? ''),
      academicYear: String(
        localStorage.getItem(SESSION_KEYS.year) ?? userData.syear ?? userData.academic_year_id ?? ''
      ),
      termId: String(userData.term_id ?? userData.marking_period_id ?? menuContext.term_id ?? ''),
    };
  } catch {
    return {};
  }
}

export interface UseAiWorkspaceOptions {
  /** A page that knows its subject better than its URL does — a selected grid row. */
  entityType?: string | null;
  entityId?: string | number | null;
  selectedRecords?: Array<{ entity?: string; id: unknown }>;
  pageData?: Record<string, unknown>;
  /** Skip resolving until the panel is actually open. */
  enabled?: boolean;
}

export function useAiWorkspace(options: UseAiWorkspaceOptions = {}) {
  const { entityType, entityId, selectedRecords, pageData, enabled = true } = options;

  const pathname = usePathname() || '/dashboard';
  const [payload, setPayload] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held separately so an action can refresh just the stage strip without
  // re-resolving every suggestion — the strip changes far more often than the
  // suggestion list does.
  const [flow, setFlow] = useState<FlowState | null>(null);

  const session = useMemo(() => readSession(), []);

  // Guards against an out-of-order reply clobbering a newer one.
  const requestRef = useRef(0);

  const selectedKey = useMemo(
    () => JSON.stringify(selectedRecords ?? []),
    [selectedRecords]
  );
  const pageDataKey = useMemo(() => JSON.stringify(pageData ?? {}), [pageData]);

  const load = useCallback(async () => {
    if (!enabled) return;

    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchWorkspaceContext(session, {
        route: pathname,
        entity_type: entityType ?? null,
        entity_id: entityId ?? null,
        selected_records: selectedRecords,
        page_data: pageData,
      });

      if (requestId === requestRef.current) {
        setPayload(result);
        setFlow(result.flow ?? null);
      }
    } catch (caught) {
      if (requestId === requestRef.current) {
        // A failure here must not take the assistant down with it. The panel falls
        // back to conversation-only, which is what it did before this existed.
        setError(caught instanceof Error ? caught.message : 'AI workspace context failed to load.');
        setPayload(null);
        setFlow(null);
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
    // selectedKey/pageDataKey stand in for the object identities so a caller passing
    // an inline array does not retrigger this on every render.
  }, [enabled, session, pathname, entityType, entityId, selectedKey, pageDataKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const context = payload?.context ?? null;

  const availableTabs = useMemo<Capability[]>(() => {
    const order: Capability[] = ['conversational', 'generative', 'agent', 'workflow', 'ontology'];

    if (!context) {
      // Before context resolves — and if it never does — conversation is all there is.
      return ['conversational'];
    }

    return order.filter((capability) => {
      if (!context.capabilities?.[capability]) return false;

      // Hide a tab that would open empty. Conversation is exempt: it always works,
      // suggestions or not.
      if (capability === 'conversational') return true;

      return (payload?.suggestions?.[capability]?.length ?? 0) > 0;
    });
  }, [context, payload]);

  /**
   * Refresh just the stage strip. Called after an agent run, an approval or a
   * workflow step, where the stage moves but the suggestion list does not.
   */
  const reloadFlow = useCallback(async () => {
    if (!context?.entity_type || context.entity_id == null) return;

    try {
      const result = await fetchFlowState(session, {
        route: pathname,
        entity_type: context.entity_type,
        entity_id: context.entity_id,
      });

      setFlow(result.flow);
    } catch {
      // The strip is supplementary. Leaving the previous state on screen is better
      // than blanking it because a refresh failed.
    }
  }, [session, pathname, context?.entity_type, context?.entity_id]);

  return {
    route: pathname,
    session,
    payload,
    context,
    flow,
    reloadFlow,
    suggestions: payload?.suggestions ?? {},
    active: payload?.active ?? { workflow_runs: [], pending_recommendations: [] },
    ontologyViews: payload?.ontology_views ?? [],
    availableTabs,
    loading,
    error,
    reload: load,
  };
}
