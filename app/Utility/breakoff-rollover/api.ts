import {
  isRecord,
  labelledKeys,
  messageFrom,
  readNumber,
  readString,
  utilityRequest,
  type LabelledKey,
} from "../_lib/erp";

/**
 * Breakoff rollover — the fee-breakoff slice of the year-end utilities.
 *
 * Two Laravel operations back this screen, both already implemented:
 *  1. Roll fee data into the next year —
 *     `rollOverController::create()` with `tables[]` limited to the fee chain
 *     `fees_map_years` → `fees_title` → `fees_breackoff` (+ `advance_fees`).
 *     The controller inserts `fees_breackoff` rows for the next year, re-pointing
 *     `fee_type_id` at the newly created `fees_title` rows and shifting the
 *     `month_id` year suffix. It skips rows with amount 0 and refuses to run
 *     twice (it checks for existing next-year rows first).
 *  2. Delete a month's breakoff for the current year —
 *     `studentBulkUpdateController::store()` with `bk_month[]`, which archives
 *     each row into `fees_breackoff_logs` before deleting it.
 */

const ROLLOVER_PATH = "student/rollover/create";
const ROLLOVER_STATUS_PATH = "student/rollover";
const BULK_UPDATE_PATH = "student/student_bulk_update";

/**
 * The fee chain, in dependency order. `fees_breackoff` joins `fees_title` on
 * `rollover_id`, so the titles must exist in the next year first; the titles in
 * turn are scoped by `fees_map_years`.
 */
export const FEE_ROLLOVER_TABLES = ["fees_map_years", "fees_title", "fees_breackoff"];
export const ADVANCE_FEES_TABLE = "advance_fees";

export type FeeRolloverModule = {
  key: string;
  label: string;
  existingCount: number;
  done: boolean;
};

export type BreakoffRolloverStatus = {
  instituteName: string;
  modules: FeeRolloverModule[];
};

export async function loadBreakoffRolloverStatus(): Promise<BreakoffRolloverStatus> {
  const payload = await utilityRequest(ROLLOVER_STATUS_PATH);
  const status = isRecord(payload.table_array_check) ? payload.table_array_check : {};
  const relevant = new Set([...FEE_ROLLOVER_TABLES, ADVANCE_FEES_TABLE]);

  return {
    instituteName: readString(payload.from_institute_name).trim(),
    modules: labelledKeys(payload.table_array)
      .filter((entry) => relevant.has(entry.key))
      .map((entry) => {
        const existingCount = readNumber(status[entry.key]);
        return {
          key: entry.key,
          label: entry.label,
          existingCount,
          done: existingCount > 0,
        };
      }),
  };
}

export async function rolloverFeeBreakoff(includeAdvanceFees: boolean): Promise<string> {
  const tables = includeAdvanceFees
    ? [...FEE_ROLLOVER_TABLES, ADVANCE_FEES_TABLE]
    : [...FEE_ROLLOVER_TABLES];
  const payload = await utilityRequest(ROLLOVER_PATH, { query: { tables } });
  return messageFrom(payload, "Fee breakoff rolled over.");
}

/** `FeeMonthId()` builds the 12 fee months of the year as `{ "42026": "Apr/2026" }`. */
export async function loadBreakoffMonths(): Promise<LabelledKey[]> {
  const payload = await utilityRequest(BULK_UPDATE_PATH);
  return labelledKeys(payload.bk_month);
}

export async function deleteBreakoffMonths(monthIds: string[]): Promise<string> {
  const payload = await utilityRequest(BULK_UPDATE_PATH, {
    method: "POST",
    body: { bk_month: monthIds },
  });
  return messageFrom(payload, "Selected breakoff months deleted.");
}
