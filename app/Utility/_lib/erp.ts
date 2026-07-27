/**
 * The Utility menus and the Admin services menus both drive the same Blade-era
 * Laravel controllers, so the transport now lives in `@/lib/erp-legacy`. This
 * module keeps the original `utilityRequest` / `utilityUpload` names so no
 * Utility page had to change.
 */
export {
  buildQuery,
  contextBody,
  errorMessage,
  isRecord,
  labelledKeys,
  legacyRequest as utilityRequest,
  legacyUpload as utilityUpload,
  messageFrom,
  readNumber,
  readString,
  recordArray,
  requireSession,
} from "@/lib/erp-legacy";

export type {
  LabelledKey,
  QueryInput,
  QueryValue,
  SessionContext,
  UnknownRecord,
} from "@/lib/erp-legacy";
