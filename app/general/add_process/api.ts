import {
  errorMessage,
  isRecord,
  legacyRequest,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  type UnknownRecord,
} from "@/lib/erp-legacy";
import { readStoredSops, type StoredSop } from "@/lib/process";

const BASE_PATH = "requirements";
/** An api.php route, unlike BASE_PATH — hence the prefix. */
const SOP_PATH = "api/ai-sop";
const STATIC_SUB_INSTITUTE_ID = "0";
const PROCESS_FLAG = "1";

export type AddProcessRecord = {
  id: number;
  menuId: number;
  /** For converted rows this is the procedure key, e.g. "LMS + PAL 6.9.4". */
  menuName: string;
  requirements: string;
  createdByName: string;
};

function mapRecord(record: UnknownRecord): AddProcessRecord {
  return {
    id: readNumber(record.id),
    menuId: readNumber(record.menu_id),
    menuName: readString(record.menu_name).trim(),
    requirements: readString(record.requirements).trim(),
    createdByName: readString(record.created_by_name).trim(),
  };
}

function readPayloadList(payload: UnknownRecord, key: string): UnknownRecord[] {
  const value = payload[key];
  return recordArray(value);
}

/**
 * Every stored row.
 *
 * The legacy screen also fetched `requirements/create` for its menu picker.
 * Converted processes are keyed by procedure, not by menu, so that request and
 * the whole menu vocabulary are gone - one call instead of two.
 */
export async function loadAddProcessRecords(): Promise<AddProcessRecord[]> {
  try {
    const payload = await legacyRequest(BASE_PATH);
    return readPayloadList(payload, "TrizProcess").map(mapRecord);
  } catch (value: unknown) {
    throw new Error(errorMessage(value, "Add Process data could not be loaded."));
  }
}

/**
 * The institute's own SOP documents, for the Process group and Procedure
 * pickers of a module that ships no catalogue.
 *
 * Upstream: GET /api/ai-sop (AiSopGenerationController::index), the same table
 * the AI Stack knowledge-base screens read. Active only: a draft is somebody's
 * work in progress, and a process converted from one would carry its name as
 * provenance.
 *
 * TWO THINGS ABOUT THE PATH, both learned the hard way.
 *
 * It carries the `api/` prefix. `legacyRequest` proxies to whatever sits under
 * API_BASE_URL, which has no `/api` segment — correct for `requirements`, a
 * web.php route, and wrong for this one, which lives in api.php. Without the
 * prefix the call resolved to /ai-sop and returned 404.
 *
 * And it goes through the proxy rather than straight to Laravel. A direct
 * browser call is cross-origin, `fetchLaravelJson` sends
 * `credentials: 'include'`, and the ERP sets `supports_credentials => false` —
 * so the preflight comes back without Access-Control-Allow-Credentials and the
 * browser discards the response as "Failed to fetch". The proxy fetches from
 * the server, where none of that applies.
 */
export async function loadInstituteSops(): Promise<StoredSop[]> {
  try {
    const payload = await legacyRequest(SOP_PATH, { query: { status: "Active" } });
    return readStoredSops(payload);
  } catch (value: unknown) {
    throw new Error(errorMessage(value, "The institute SOP library could not be loaded."));
  }
}

export type AddProcessInput = {
  menuDetails: string;
  requirements: string;
};

export async function createAddProcess(input: AddProcessInput): Promise<string> {
  const payload = await legacyRequest(BASE_PATH, {
    method: "POST",
    body: {
      menuDetails: input.menuDetails,
      requirements: input.requirements,
      sub_institute_id: STATIC_SUB_INSTITUTE_ID,
      process: PROCESS_FLAG,
    },
  });

  return messageFrom(payload, "Process added successfully.");
}

export async function updateAddProcess(id: number, input: Pick<AddProcessInput, "requirements">): Promise<string> {
  const payload = await legacyRequest(`${BASE_PATH}/${id}`, {
    method: "PUT" as any,
    body: {
      requirements: input.requirements,
      sub_institute_id: STATIC_SUB_INSTITUTE_ID,
    },
  });

  return messageFrom(payload, "Process updated successfully.");
}

export async function deleteAddProcess(id: number): Promise<string> {
  const payload = await legacyRequest(`${BASE_PATH}/${id}`, {
    method: "DELETE" as any,
    body: {},
  });

  return messageFrom(payload, "Process deleted successfully.");
}

export async function loadAddProcessById(id: number): Promise<AddProcessRecord> {
  const payload = await legacyRequest(`${BASE_PATH}/${id}/edit`);
  const record = payload.editData;
  if (!isRecord(record)) {
    throw new Error("The selected process could not be loaded.");
  }

  return mapRecord(record);
}
