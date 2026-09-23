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

const BASE_PATH = "requirements";
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
