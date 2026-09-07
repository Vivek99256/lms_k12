"use client";

/**
 * Persistence for converted processes.
 *
 * Deliberately thin, and deliberately the *only* module that knows where a
 * process is stored. Everything above it works in `ProcessSpec` terms and never
 * names a row, a column or a menu.
 *
 * The store is the legacy `requirement_gathering` table this screen has always
 * written, with two changes from how the old screen used it. The value is a
 * JSON envelope rather than CKEditor HTML, and the row is keyed by *procedure*
 * (`storageKeyFor`) rather than by menu - see that function for why the menu
 * key was unsafe. Together those mean no migration against a shared production
 * database, no new endpoint, legacy rows left untouched, and no way for a
 * converted process to land on a row that onboarding or the tour reads.
 *
 * When the module earns its own tables, this file is what changes.
 */

import {
  checkSize,
  createEnvelope,
  decodeEnvelope,
  encodeEnvelope,
  storageKeyFor,
  upsertProcess,
  type DecodedValue,
  type ProcessSpec,
  type ProcessSpecEnvelope,
  type SopModule,
} from "@/lib/process";
import { createAddProcess, loadAddProcessRecords, type AddProcessRecord } from "../api";

/** One stored row, with its payload already decoded. */
export interface StoredProcessRow {
  record: AddProcessRecord;
  decoded: DecodedValue;
  /** The procedures this row carries. Empty for a legacy free-text row. */
  processes: ProcessSpec[];
}

function processesOf(decoded: DecodedValue): ProcessSpec[] {
  return decoded.kind === "envelope" ? decoded.envelope.processes : [];
}

export async function loadProcessRows(): Promise<StoredProcessRow[]> {
  const records = await loadAddProcessRecords();
  return records.map((record) => {
    const decoded = decodeEnvelope(record.requirements);
    return { record, decoded, processes: processesOf(decoded) };
  });
}

export class ProcessStoreError extends Error {}

/**
 * Write a process to its own row.
 *
 * The Laravel controller upserts on (menu_id, menu_name, sub_institute_id), and
 * `storageKeyFor` makes that triple unique per procedure - so a create call is
 * also the update path, and re-saving 6.9.4 rewrites 6.9.4's row and nothing
 * else. The envelope still carries a `processes` array: the shape is the same
 * whether a row holds one procedure or, some day, a grouped set.
 */
export async function saveProcess(params: {
  spec: ProcessSpec;
  module: SopModule;
}): Promise<{ message: string; envelope: ProcessSpecEnvelope }> {
  const { spec, module } = params;
  const envelope = upsertProcess(
    createEnvelope({ module: module.name, sop: module.sop }),
    spec
  );

  const size = checkSize(envelope);
  if (!size.withinBudget) {
    throw new ProcessStoreError(
      `This process serialises to ${size.bytes.toLocaleString()} bytes, over the ${size.budget.toLocaleString()}-byte column limit. ` +
        `Shorten the procedure text, or split it into two procedures.`
    );
  }

  const message = await createAddProcess({
    menuDetails: storageKeyFor(spec).menuDetails,
    requirements: encodeEnvelope(envelope),
  });

  return { message, envelope };
}
