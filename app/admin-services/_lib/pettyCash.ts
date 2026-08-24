import {
  isRecord,
  legacyRequest,
  legacyUpload,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  requireSession,
  type UnknownRecord,
} from "@/lib/erp-legacy";

/**
 * Petty cash, petty cash master and petty cash report.
 *
 * Backed by `App\Http\Controllers\api\PettyCashApiController` on the stateless,
 * CSRF-exempt `api/*` routes:
 *   GET  api/petty-cash/heads              -> expense heads
 *   POST api/petty-cash/heads              -> add head
 *   POST api/petty-cash/heads/{id}         -> rename head
 *   POST api/petty-cash/heads/{id}/delete  -> delete head (refused while in use)
 *   GET  api/petty-cash                    -> entries + heads
 *   GET  api/petty-cash/{id}               -> one entry
 *   POST api/petty-cash                    -> add entry (multipart bill image)
 *   POST api/petty-cash/{id}               -> update entry (multipart bill image)
 *   POST api/petty-cash/{id}/delete        -> delete entry
 *   GET  api/petty-cash/report             -> date + head filtered entries
 *
 * The Blade-era `frontdesk/pettycash*` routes are not used. Chiefly because
 * `PettyCashController::update()` writes to `petty_cash_master`, so editing an
 * entry there overwrites an expense head; the write controllers also insert
 * `$request->except([...])` verbatim and every read is session-scoped.
 *
 * `petty_cash.amount` is an INT column, so amounts are whole numbers.
 */

const PATH = "api/petty-cash";
const HEADS_PATH = `${PATH}/heads`;

export type PettyCashHead = {
  id: number;
  title: string;
};

export type PettyCashEntry = {
  id: number;
  titleId: number;
  titleName: string;
  amount: string;
  description: string;
  billDate: string;
  billImage: string;
  billImageUrl: string;
  userName: string;
};

export type PettyCashBoard = {
  entries: PettyCashEntry[];
  heads: PettyCashHead[];
};

export type PettyCashEntryInput = {
  createdOn: string;
  titleId: string;
  amount: string;
  description: string;
  billImage: File | null;
};

function mapHead(record: UnknownRecord): PettyCashHead {
  return {
    id: readNumber(record.id),
    title: readString(record.title).trim(),
  };
}

function mapEntry(record: UnknownRecord): PettyCashEntry {
  return {
    id: readNumber(record.id),
    titleId: readNumber(record.title_id),
    titleName: readString(record.title_name).trim(),
    amount: readString(record.amount).trim(),
    description: readString(record.description).trim(),
    billDate: readString(record.bill_date ?? record.created_on).slice(0, 10),
    billImage: readString(record.bill_image).trim(),
    billImageUrl: readString(record.bill_image_url).trim(),
    userName: readString(record.user_name).replace(/\s+/g, " ").trim(),
  };
}

function data(payload: UnknownRecord): UnknownRecord {
  return isRecord(payload.data) ? payload.data : {};
}

export async function loadPettyCashHeads(): Promise<PettyCashHead[]> {
  const payload = await legacyRequest(HEADS_PATH);
  return recordArray(data(payload).heads).map(mapHead);
}

export async function createPettyCashHead(title: string): Promise<string> {
  const payload = await legacyRequest(HEADS_PATH, { method: "POST", body: { title } });
  return messageFrom(payload, "Petty cash head added successfully.");
}

export async function updatePettyCashHead(id: number, title: string): Promise<string> {
  const payload = await legacyRequest(`${HEADS_PATH}/${id}`, {
    method: "POST",
    body: { title },
  });
  return messageFrom(payload, "Petty cash head updated successfully.");
}

export async function deletePettyCashHead(id: number): Promise<string> {
  const session = requireSession();
  const payload = await legacyRequest(`${HEADS_PATH}/${id}/delete`, {
    method: "POST",
    session,
    body: {},
  });
  return messageFrom(payload, "Petty cash head deleted successfully.");
}

export async function loadPettyCashBoard(): Promise<PettyCashBoard> {
  const payload = await legacyRequest(PATH);
  const body = data(payload);
  return {
    entries: recordArray(body.entries).map(mapEntry),
    heads: recordArray(body.heads).map(mapHead),
  };
}

function entryFormData(input: PettyCashEntryInput): FormData {
  const formData = new FormData();
  formData.append("created_on", input.createdOn);
  formData.append("title_id", input.titleId);
  formData.append("amount", input.amount);
  formData.append("description", input.description);
  if (input.billImage) formData.append("bill_image", input.billImage);
  return formData;
}

export async function createPettyCashEntry(input: PettyCashEntryInput): Promise<string> {
  const payload = await legacyUpload(PATH, entryFormData(input));
  return messageFrom(payload, "Petty cash entry added successfully.");
}

export async function updatePettyCashEntry(
  id: number,
  input: PettyCashEntryInput
): Promise<string> {
  const payload = await legacyUpload(`${PATH}/${id}`, entryFormData(input));
  return messageFrom(payload, "Petty cash entry updated successfully.");
}

export async function deletePettyCashEntry(id: number): Promise<string> {
  const session = requireSession();
  const payload = await legacyRequest(`${PATH}/${id}/delete`, {
    method: "POST",
    session,
    body: {},
  });
  return messageFrom(payload, "Petty cash entry deleted successfully.");
}

export type PettyCashReport = {
  entries: PettyCashEntry[];
  heads: PettyCashHead[];
  total: number;
};

export async function loadPettyCashReport(filter: {
  fromDate: string;
  toDate: string;
  titleId: string;
}): Promise<PettyCashReport> {
  const payload = await legacyRequest(`${PATH}/report`, {
    query: {
      from_date: filter.fromDate,
      to_date: filter.toDate,
      // An empty head means "every head".
      title_id: filter.titleId,
    },
  });
  const body = data(payload);
  return {
    entries: recordArray(body.entries).map(mapEntry),
    heads: recordArray(body.heads).map(mapHead),
    total: readNumber(body.total),
  };
}
