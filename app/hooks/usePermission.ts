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
  /**
   * Requested modules the server has no entry for at all.
   *
   * `GET /api/permissions` intersects the request with the keys registered in
   * `config/rbac_modules.php` and reports the remainder as `unknown_modules`. A
   * key it did not answer is a DIFFERENT fact from a key it answered `false`: the
   * first means the server cannot speak about the capability, the second means it
   * can and says no. Without this the caller cannot tell "you are not allowed"
   * from "nobody here knows what this is", and the second gets rendered as the
   * first — which is how a registered-but-ungranted module and an unregistered
   * one both produced "Your role cannot change X" for an administrator.
   */
  unknownModules: string[];
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
  /**
   * The same list, read back off the stable `key`.
   *
   * `modules` is a fresh array on every render, so it cannot be an effect
   * dependency — the effect would re-run (and re-fetch) forever. `key` is memoised
   * off it and changes only when the set of modules actually changes, which makes
   * it the correct dependency and the correct source for the names.
   */
  const requested = useMemo(() => (key ? key.split(',') : []), [key]);

  const [permissions, setPermissions] = useState<Record<string, ModulePermissions> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknownModules, setUnknownModules] = useState<string[]>([]);
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
            setUnknownModules([...requested]);
          }
          return;
        }

        const url = `${session.baseUrl}/api/permissions?modules=${encodeURIComponent(key)}`;
        const res = await fetch(url, { headers: createAuthHeaders(session), cache: 'no-store' });
        const body = await res.json().catch(() => null);

        if (cancelled) return;

        // Whatever the server reported as unrecognised, plus anything it simply did
        // not return an entry for. The two agree in practice — it intersects the
        // request with its registry and lists the remainder — but deriving the list
        // from the response itself rather than trusting `unknown_modules` alone means
        // an older or trimmed server still reports the truth.
        const reported: string[] = Array.isArray(body?.unknown_modules) ? body.unknown_modules.map(String) : [];
        const answered = new Set(Object.keys((body?.data as Record<string, unknown>) ?? {}));
        const unanswered = requested.filter((module) => !answered.has(module));

        setUnknownModules([...new Set([...reported, ...unanswered])]);

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
          setUnknownModules([...requested]);
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
  }, [key, nonce, requested]);

  return { permissions, loading, authenticated, error, unknownModules, refresh };
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
