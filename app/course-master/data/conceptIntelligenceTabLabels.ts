import { API_BASE_URL } from '@/app/components/utils/api_url';
import { buildSessionContext, readString } from '@/lib/erp-client';

/**
 * Course Master -> Concept Intelligence — tenant-wise tab names.
 *
 * Mirrors `/api/lms/concept-intelligence/tab-labels*`
 * (App\Http\Controllers\api\lms\ConceptIntelligenceTabLabelApiController), same
 * `{ status, message, data }` envelope as the rest of the LMS API.
 *
 * The names shown above the intelligence panel are per institute: institute 1
 * renaming "Real World" to "Real World Application" changes nothing for
 * institute 3. The server merges the shipped default (blueprint), any
 * estate-wide row, and this institute's own overrides, and returns one resolved
 * label per tab — so nothing here needs to know which layer a name came from.
 *
 * DEFAULT_TAB_LABELS below is an offline fallback only: it keeps the strip
 * readable if the label request fails. The server is the source of truth.
 */

const LIST_PATH = '/api/lms/concept-intelligence/tab-labels';
const UPDATE_PATH = '/api/lms/concept-intelligence/tab-labels/update';
const RESET_PATH = '/api/lms/concept-intelligence/tab-labels/reset';

/** Matches config/lms_concept_intelligence_tabs.php. */
export const DEFAULT_TAB_LABELS: Record<string, string> = {
  overview: 'Overview',
  knowledge: 'Knowledge',
  abilities: 'Abilities',
  skills: 'Skills',
  competencies: 'Competencies',
  blooms: "Bloom's",
  dok: 'DOK',
  prerequisites: 'Prerequisites',
  misconceptions: 'Misconceptions',
  realworld: 'Real World',
  pedagogy: 'Pedagogy',
  objectives: 'Objectives',
  outcomes: 'Outcomes',
  blueprint: 'Blueprint',
  rubrics: 'Rubrics',
  relationships: 'Relationships',
  evidence: 'Evidence',
  reasoning: 'AI Reasoning',
};

/** Kept in step with the custom_label column, so the UI stops before the API does. */
export const MAX_TAB_LABEL_LENGTH = 120;

export interface ConceptIntelligenceTabLabel {
  tabKey: string;
  /** What this institute sees. */
  label: string;
  /** What the tab is called before anyone renames it. */
  defaultLabel: string;
  /** Which layer supplied `label`. */
  source: 'institute' | 'estate' | 'default';
}

export interface ConceptIntelligenceTabLabels {
  subInstituteId: string;
  tabs: ConceptIntelligenceTabLabel[];
  /** tab_key -> label, ready to index straight from the tab strip. */
  byKey: Record<string, string>;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalise(payload: unknown, fallbackTenant: string): ConceptIntelligenceTabLabels {
  const data = toRecord(toRecord(payload).data);
  const rows = Array.isArray(data.tabs) ? data.tabs : [];

  const tabs = rows.map((row) => {
    const record = toRecord(row);
    const tabKey = readString(record.tab_key);
    const defaultLabel = readString(record.default_label) || DEFAULT_TAB_LABELS[tabKey] || tabKey;
    const source = readString(record.source);

    return {
      tabKey,
      label: readString(record.label) || defaultLabel,
      defaultLabel,
      source: source === 'institute' || source === 'estate' ? source : 'default',
    } satisfies ConceptIntelligenceTabLabel;
  });

  return {
    subInstituteId: readString(data.sub_institute_id) || fallbackTenant,
    tabs,
    byKey: tabs.reduce<Record<string, string>>((acc, tab) => {
      if (tab.tabKey) acc[tab.tabKey] = tab.label;
      return acc;
    }, {}),
  };
}

async function callApi(
  path: string,
  body: Record<string, unknown> | null,
  signal?: AbortSignal
): Promise<ConceptIntelligenceTabLabels> {
  const session = buildSessionContext();
  const subInstituteId = session.subInstituteId;

  if (!subInstituteId) {
    throw new Error('Session data is missing. Please sign in again.');
  }

  const isRead = body === null;
  const url = new URL(`${API_BASE_URL}${path}`);

  if (isRead) {
    url.searchParams.set('sub_institute_id', subInstituteId);
  }

  const response = await fetch(url.toString(), {
    method: isRead ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(isRead ? {} : { 'Content-Type': 'application/json' }),
      // Sent so these routes keep working unchanged if they are moved behind
      // `api.session`, where the token — not the posted id — decides the tenant.
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: isRead
      ? undefined
      : JSON.stringify({ sub_institute_id: subInstituteId, user_id: session.userId, ...body }),
    signal,
  });

  const text = await response.text();
  let payload: unknown = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('The server returned an unreadable response.');
  }

  const envelope = toRecord(payload);

  if (!response.ok || envelope.status === false) {
    throw new Error(readString(envelope.message) || 'Could not load tab names.');
  }

  return normalise(payload, subInstituteId);
}

/** The resolved tab names for the signed-in institute. */
export function fetchConceptIntelligenceTabLabels(
  signal?: AbortSignal
): Promise<ConceptIntelligenceTabLabels> {
  return callApi(LIST_PATH, null, signal);
}

/**
 * Rename one tab for the signed-in institute.
 *
 * Passing a blank label — or the tab's own default — clears the override, so
 * the tab goes back to following the shipped name.
 */
export function saveConceptIntelligenceTabLabel(
  tabKey: string,
  label: string
): Promise<ConceptIntelligenceTabLabels> {
  return callApi(UPDATE_PATH, { tab_key: tabKey, label });
}

/** Restore the shipped names — one tab when `tabKey` is given, otherwise all. */
export function resetConceptIntelligenceTabLabels(
  tabKey?: string
): Promise<ConceptIntelligenceTabLabels> {
  return callApi(RESET_PATH, tabKey ? { tab_key: tabKey } : {});
}
