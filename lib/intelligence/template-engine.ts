import { callMcpTool } from '@/lib/ai/mcp-client';
import type { IntelligenceContext } from './client';

/**
 * The template engine, from the browser.
 *
 * Everything here goes through `/api/mcp/tools/call` rather than through a Next.js
 * route of its own. That is deliberate: the tools this flow needs —
 * `admissions.listEnquiries`, `admissions.getEnquiryDetails`, `ai.templates.render` —
 * are all registered, all scoped from the JWT on the Laravel side, and all read-only.
 * Adding a proxy route would have meant a second place for the tenant to be decided,
 * which is the one thing the MCP context hydrator exists to prevent.
 *
 * The distinction that shapes this file: a *report* is a saved `template_master` row
 * with an id, which is why `/ai-reports/{id}` can edit and send it. A *certificate* —
 * one student's admission confirmation — is not stored anywhere; it is composed from
 * the enquiry record every time it is opened. So its link carries the enquiry, not a
 * document id, and the document is always current rather than a snapshot that quietly
 * ages.
 */

/** One row of the pending-admission list, as `admissions.listEnquiries` returns it. */
export interface PendingEnquiry {
  enquiry_id: number;
  enquiry_no: string | null;
  student_name: string | null;
  mobile: string | null;
  standard_id: number | null;
  standard_name: string | null;
  status: string | null;
  followup_date: string | null;
}

/** The fields `ai.templates.render` substitutes, and the ones this page draws. */
export interface EnquiryValues {
  student_name: string;
  enquiry_no: string;
  enquiry_id: string;
  mobile: string;
  standard_name: string;
  division_name: string;
  quota_name: string;
  admission_date: string;
  status: string;
}

export interface RenderedTemplate {
  id: number;
  title: string;
  html: string;
  unresolved_tokens: string[];
}

function mcpContext(context: IntelligenceContext) {
  return {
    token: context.token,
    meta: {
      instituteId: context.instituteId,
      academicYear: context.academicYear,
    },
  };
}

/**
 * Unwrap `{data: {result: ToolResult}}`.
 *
 * A tool that answers "no" — no such enquiry, no template in the library — comes back
 * as a 200 with `result.success === false`, because the request succeeded and the
 * answer was negative. Those are returned rather than thrown so a caller can treat
 * "there is no template" as a branch instead of an exception.
 */
function unwrap(payload: Record<string, unknown>): {
  ok: boolean;
  data: Record<string, unknown>;
  message: string;
} {
  const outer = (payload?.data ?? {}) as Record<string, unknown>;
  const result = (outer?.result ?? {}) as Record<string, unknown>;

  return {
    ok: result?.success === true,
    data: (result?.data ?? {}) as Record<string, unknown>,
    message: typeof result?.message === 'string' ? result.message : '',
  };
}

function text(value: unknown): string {
  if (value == null) return '';

  const trimmed = String(value).trim();

  // The ERP writes an unset date as all zeroes rather than NULL, and printing
  // "0000-00-00" on a certificate is worse than printing nothing.
  return trimmed === '0000-00-00' || trimmed === 'null' ? '' : trimmed;
}

function toNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').trim());

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Every admission enquiry still waiting, newest first — the selection list. */
export async function listPendingEnquiries(
  context: IntelligenceContext,
  limit = 50
): Promise<PendingEnquiry[]> {
  const payload = await callMcpTool(mcpContext(context), {
    tool: 'admissions.listEnquiries',
    arguments: { limit },
  });

  const { ok, data } = unwrap(payload);

  if (!ok) return [];

  const rows = Array.isArray(data.enquiries) ? data.enquiries : [];

  return rows
    .map((row) => row as Record<string, unknown>)
    .map((row) => ({
      enquiry_id: Number(row.enquiry_id ?? 0),
      enquiry_no: text(row.enquiry_no) || null,
      student_name: text(row.student_name) || null,
      mobile: text(row.mobile) || null,
      standard_id: toNumber(row.standard_id),
      standard_name: text(row.standard_name) || null,
      status: text(row.status) || null,
      followup_date: text(row.followup_date) || null,
    }))
    .filter((row) => row.enquiry_id > 0);
}

/**
 * Find the enquiry a link refers to.
 *
 * The reference in a URL may be either the internal id or the enquiry number a person
 * actually reads off the screen ("2022012"), and both look like integers. So the list
 * is the authority: whichever field matches, the row it comes from carries the real
 * id. Matching the number first means a link built from what the chat displayed
 * resolves to the same record the chat was showing.
 */
export async function findEnquiry(
  context: IntelligenceContext,
  reference: string
): Promise<PendingEnquiry | null> {
  const wanted = reference.trim();

  if (!wanted) return null;

  const rows = await listPendingEnquiries(context, 200);

  return (
    rows.find((row) => row.enquiry_no === wanted) ??
    rows.find((row) => String(row.enquiry_id) === wanted) ??
    null
  );
}

/**
 * The full record behind one enquiry, merged over the list row.
 *
 * Both tools read the same enquiry but not the same columns — the list carries the
 * enquiry number and the standard, the detail call carries the division, quota and
 * admission date. Neither alone fills the certificate, so the detail call is layered
 * over the list row and only its non-empty fields win.
 */
export async function enquiryValues(
  context: IntelligenceContext,
  row: PendingEnquiry
): Promise<EnquiryValues> {
  const base: EnquiryValues = {
    student_name: row.student_name ?? '',
    enquiry_no: row.enquiry_no ?? '',
    enquiry_id: String(row.enquiry_id),
    mobile: row.mobile ?? '',
    standard_name: row.standard_name ?? '',
    division_name: '',
    quota_name: '',
    admission_date: '',
    status: row.status ?? '',
  };

  try {
    const payload = await callMcpTool(mcpContext(context), {
      tool: 'admissions.getEnquiryDetails',
      arguments: { enquiry_id: row.enquiry_id },
    });

    const { ok, data } = unwrap(payload);

    if (!ok) return base;

    const detail = (data.enquiry ?? {}) as Record<string, unknown>;
    const merged = { ...base };

    (Object.keys(base) as Array<keyof EnquiryValues>).forEach((key) => {
      const value = text(detail[key]);

      if (value) merged[key] = value;
    });

    return merged;
  } catch {
    // The detail call is an enrichment, not a dependency. A certificate built from the
    // list row alone is still a real record; failing the whole page because the second
    // read timed out would be worse than a document with one blank field.
    return base;
  }
}

/**
 * The school's own admission-confirmation template, if it has authored one.
 *
 * Returns null rather than throwing when the library has no such template. That is the
 * ordinary case — the AI category ships empty — and it is not an error: the page falls
 * back to its own document design, filled from the same record.
 */
export async function renderSchoolTemplate(
  context: IntelligenceContext,
  enquiryId: number,
  title = 'Admission Confirmation'
): Promise<RenderedTemplate | null> {
  try {
    const payload = await callMcpTool(mcpContext(context), {
      tool: 'ai.templates.render',
      arguments: { enquiry_id: enquiryId, title },
    });

    const { ok, data } = unwrap(payload);

    if (!ok) return null;

    const template = (data.template ?? {}) as Record<string, unknown>;
    const html = text(data.html);

    if (!html) return null;

    return {
      id: Number(template.id ?? 0),
      title: text(template.title) || title,
      html,
      unresolved_tokens: Array.isArray(data.unresolved_tokens)
        ? (data.unresolved_tokens as string[])
        : [],
    };
  } catch {
    return null;
  }
}
