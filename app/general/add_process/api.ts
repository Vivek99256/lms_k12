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

export type AddProcessMenuOption = {
  id: number;
  menuTitle: string;
  menuDetails: string;
};

export type AddProcessRecord = {
  id: number;
  menuId: number;
  menuName: string;
  requirements: string;
  createdByName: string;
};

export type AddProcessBoard = {
  records: AddProcessRecord[];
  menuOptions: AddProcessMenuOption[];
};

function mapMenuOption(record: UnknownRecord): AddProcessMenuOption | null {
  const id = readNumber(record.parent_menu_id);
  const menuTitle = readString(record.menu_title).trim();
  if (!id || !menuTitle) return null;

  return {
    id,
    menuTitle,
    menuDetails: `${id}/${menuTitle}`,
  };
}

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

export async function loadAddProcessBoard(): Promise<AddProcessBoard> {
  try {
    const [listPayload, createPayload] = await Promise.all([
      legacyRequest(BASE_PATH),
      legacyRequest(`${BASE_PATH}/create`),
    ]);

    const records = readPayloadList(listPayload, "TrizProcess").map(mapRecord);
    const menuOptions = readPayloadList(createPayload, "allMenu")
      .map(mapMenuOption)
      .filter((option): option is AddProcessMenuOption => Boolean(option))
      .sort((left, right) => left.menuTitle.localeCompare(right.menuTitle, undefined, { sensitivity: "base" }));

    return { records, menuOptions };
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
    method: "PUT",
    body: {
      requirements: input.requirements,
      sub_institute_id: STATIC_SUB_INSTITUTE_ID,
    },
  });

  return messageFrom(payload, "Process updated successfully.");
}

export async function deleteAddProcess(id: number): Promise<string> {
  const payload = await legacyRequest(`${BASE_PATH}/${id}`, {
    method: "DELETE",
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
