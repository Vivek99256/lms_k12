'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

/**
 * Per-action permission flags — tracker "Content & LMS Architecture" row 5 / Decision #37.
 *
 * WHY THIS EXISTS ALONGSIDE useMenuRights
 * `useMenuRights` answers "which menu items exist for me?" and nothing else — the backend
 * it calls (MenuRightsController::getMenuRightsLevelWise) selects a GROUP_CONCAT of menu
 * ids and never the CRUD columns. So until now the content screens had no per-action data
 * to gate a button on, even though tblgroupwise_rights has carried can_view / can_add /
 * can_edit / can_delete all along.
 *
 * ADVISORY ONLY. Decision #23: "configuration can never grant a permission." This hook
 * decides whether a button LOOKS available; the server decides whether the action is
 * allowed, via the `perm:` middleware on the write route. A client that ignores this hook
 * gains nothing.
 *
 * Prefer DISABLING a gated control over hiding it: 70-80% of teachers are expected never
 * to have creation rights, and a silently missing button reads as a broken product rather
 * than as a permission boundary.
 */

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

export type ModulePermissions = Record<PermissionAction, boolean>;

export type PermissionsState = {
  /** undefined while loading — distinct from "denied", so the UI can avoid flicker. */
  permissions: Record<string, ModulePermissions> | undefined;
  loading: boolean;
  /** False when the session has no usable token; flags are then unknown, not denied. */
  authenticated: boolean;
  error: string | null;
  refresh: () => void;
};

const DENY_ALL: ModulePermissions = { view: false, create: false, update: false, delete: false };

/**
 * Fetch the flags for one or more modules.
 *
 * Module names come from the backend registry (config/rbac_modules.php): currently
 * `lms.content` and `lms.question_bank`.
 */
export function usePermissions(modules: string[]): PermissionsState {
  const key = useMemo(() => [...modules].sort().join(','), [modules]);

  const [permissions, setPermissions] = useState<Record<string, ModulePermissions> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const session = buildSessionContext();

        if (!session.token) {
          // No token: the answer is genuinely unknown. Reporting all-false here would
          // render as "you have no rights", which is a different and wrong claim.
          if (!cancelled) {
            setAuthenticated(false);
            setPermissions(undefined);
          }
          return;
        }

        const url = `${session.baseUrl}/api/permissions?modules=${encodeURIComponent(key)}`;
        const res = await fetch(url, { headers: createAuthHeaders(session), cache: 'no-store' });
        const body = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok || !body || body.status_code !== 1) {
          setAuthenticated(Boolean(body?.authenticated));
          setPermissions(undefined);
          setError(body?.message ?? `Permission lookup failed (${res.status})`);
          return;
        }

        setAuthenticated(true);
        setPermissions(body.data ?? {});
      } catch (e) {
        if (!cancelled) {
          setPermissions(undefined);
          setError(e instanceof Error ? e.message : 'Permission lookup failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  return { permissions, loading, authenticated, error, refresh };
}

/**
 * Single-module convenience.
 *
 * Returns `undefined` while loading or when the answer is unknown, so a caller can
 * distinguish "not yet known" from "denied" and avoid flashing a disabled control.
 */
export function usePermission(module: string, action: PermissionAction): boolean | undefined {
  const modules = useMemo(() => [module], [module]);
  const { permissions, loading, authenticated } = usePermissions(modules);

  if (loading) return undefined;
  if (!authenticated || !permissions) return undefined;

  return (permissions[module] ?? DENY_ALL)[action];
}
