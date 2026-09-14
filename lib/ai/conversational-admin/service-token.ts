import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { getProjectAdapter, normaliseProjectId, PROJECT_ID_HEADER, type ProjectAdapter } from '../project-resolver';
import type { ConversationalAdminStore } from './store';
import type { ServiceTokenSummary, StoredServiceToken } from './types';

/**
 * Service tokens: how an external project proves it is who it says it is.
 *
 * A browser user of the LMS carries a Laravel bearer token and Laravel derives
 * the tenant from it. A sibling service has no such user. It presents a token
 * issued here instead, and the token names its project — so a caller cannot
 * claim one project in `x-project-id` and authenticate as another.
 *
 * ONLY THE HASH IS STORED. The plaintext is returned exactly once, at rotation,
 * the way a provider API key is; what the admin screen sees afterwards is the
 * masked form with the last four characters, the same display the Easy
 * Communication master screens use for stored secrets.
 *
 * Rotation is a replacement, not an addition: the previous token stops working
 * the moment the new one is written. That is deliberate for a first version — a
 * grace window is a feature to add when a deployment needs it, not a default.
 */

export const SERVICE_TOKEN_HEADER = 'x-service-token';
const TOKEN_PREFIX = 'cai';
const MASK = '••••••••';

export function hashServiceToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

export function maskServiceToken(last4: string): string {
  return `${MASK}${last4}`;
}

export function summariseToken(token: StoredServiceToken): ServiceTokenSummary {
  return {
    project_id: token.project_id,
    masked: maskServiceToken(token.last4),
    last4: token.last4,
    created_at: token.created_at,
    rotated_by: token.rotated_by,
  };
}

/** Mint a new token for a project. The plaintext is `cai_<project>_<40 hex>`. */
export function mintServiceToken(projectId: string, rotatedBy: string | null, now = new Date()): { plaintext: string; stored: StoredServiceToken } {
  const plaintext = `${TOKEN_PREFIX}_${projectId}_${randomBytes(20).toString('hex')}`;
  return {
    plaintext,
    stored: {
      project_id: projectId,
      hash: hashServiceToken(plaintext),
      last4: plaintext.slice(-4),
      created_at: now.toISOString(),
      rotated_by: rotatedBy,
    },
  };
}

function presentedToken(request: Pick<Request, 'headers'>): string {
  const direct = request.headers.get(SERVICE_TOKEN_HEADER)?.trim();
  if (direct) return direct;
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const bearer = match?.[1]?.trim() ?? '';
  // Only a token we minted is a service token; a Laravel user bearer is not ours to judge.
  return bearer.startsWith(`${TOKEN_PREFIX}_`) ? bearer : '';
}

function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export type ServiceAuthResult =
  | { ok: true; adapter: ProjectAdapter }
  | { ok: false; reason: string };

/**
 * Authenticate a cross-service call. FAILS CLOSED: no project header, unknown
 * project, host project (which must use a user bearer instead), missing token,
 * never-issued token or a mismatch all answer `ok: false` with a reason for the log.
 */
export async function authenticateServiceRequest(
  store: ConversationalAdminStore,
  request: Pick<Request, 'headers'>,
): Promise<ServiceAuthResult> {
  const projectId = normaliseProjectId(request.headers.get(PROJECT_ID_HEADER));
  if (!projectId) return { ok: false, reason: `The ${PROJECT_ID_HEADER} header is required for a service call.` };

  const adapter = getProjectAdapter(projectId);
  if (!adapter) return { ok: false, reason: `"${projectId}" is not a registered project.` };
  if (adapter.kind !== 'external') return { ok: false, reason: `${adapter.label} is the host project; calls carry a user token, not a service token.` };

  const plaintext = presentedToken(request);
  if (!plaintext) return { ok: false, reason: 'No service token was presented.' };

  const stored = await store.getToken(projectId);
  if (!stored) return { ok: false, reason: `No service token has been issued for ${adapter.label}.` };
  if (!hashesMatch(hashServiceToken(plaintext), stored.hash)) return { ok: false, reason: 'The service token does not match.' };

  return { ok: true, adapter };
}
