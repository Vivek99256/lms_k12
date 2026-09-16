import type { EnquiryValues } from './template-engine';

/**
 * The printed document: how a report and a certificate are drawn on paper.
 *
 * Both surfaces in this feature — the saved report at `/ai-reports/{id}` and the
 * per-student certificate — render their HTML inside a sandboxed frame rather than
 * into this app's DOM. The document is admin-editable HTML stored unfiltered, which is
 * the trust position `template_master` has always had, so the mitigation is that
 * nothing in it can execute: the frame is created without `allow-scripts`.
 *
 * That constraint is why the styling lives here as a string rather than as Tailwind
 * classes. Nothing outside the frame reaches inside it, so the sheet has to carry its
 * own stylesheet, and it has to be the same stylesheet on screen and on paper —
 * otherwise Print produces a document nobody previewed.
 */

/** Escape a database value on its way into markup. */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A value, or a printed blank.
 *
 * An empty field prints as a ruled gap rather than as nothing, because a certificate
 * with a missing division reads as an unfinished document that somebody must complete,
 * while a certificate with the row silently removed reads as a complete one that is
 * wrong. The first is honest about the record; the second is not.
 */
function field(value: string): string {
  const trimmed = value.trim();

  return trimmed ? escape(trimmed) : '<span class="blank"></span>';
}

/** "7 September 2026" — how a date is written on a certificate, not in a log. */
export function formatDocumentDate(value?: string): string {
  const parsed = value ? new Date(value) : new Date();

  if (Number.isNaN(parsed.getTime())) return value ?? '';

  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The sheet: A4 proportions, a ruled border, and the same metrics on screen and paper.
 *
 * `@page` sets the printer margin and the sheet drops its own border and shadow when
 * printing, so what comes out of the printer is the document rather than a screenshot
 * of a preview of the document.
 */
export const DOCUMENT_STYLES = `
  @page { size: A4; margin: 14mm; }

  html { background: #eef1f5; }

  body {
    margin: 0;
    padding: 18px;
    font: 14px/1.65 "Times New Roman", Times, Georgia, serif;
    color: #14181f;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sheet {
    max-width: 190mm;
    margin: 0 auto;
    padding: 18mm 16mm;
    background: #fff;
    border: 1px solid #d3d9e2;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }

  /* The engraved double rule a certificate is expected to have. */
  .sheet--bordered { outline: 3px double #24324a; outline-offset: -8mm; }

  .letterhead { text-align: center; padding-bottom: 10px; }
  .letterhead h1 { margin: 0; font-size: 24px; letter-spacing: 0.04em; }
  .letterhead p { margin: 2px 0 0; font-size: 12px; color: #4b5563; }

  .rule { border: 0; border-top: 2px solid #24324a; margin: 10px 0 0; }
  .rule + .rule { border-top-width: 1px; margin-top: 2px; }

  .doc-title {
    margin: 22px auto 6px;
    display: table;
    padding: 5px 22px;
    border: 1px solid #24324a;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .meta { display: flex; justify-content: space-between; margin-top: 20px; font-size: 13px; }

  .body { margin-top: 20px; text-align: justify; font-size: 15px; }
  .body strong { font-weight: 700; }

  table.particulars { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
  table.particulars th,
  table.particulars td { border: 1px solid #b9c2d0; padding: 7px 10px; text-align: left; }
  table.particulars th { width: 38%; background: #f4f6f9; font-weight: 600; }

  /* A field with no value on record: ruled, so it reads as "to be completed". */
  .blank { display: inline-block; min-width: 110px; border-bottom: 1px dotted #98a2b3; }

  .signatures { display: flex; justify-content: space-between; margin-top: 54px; font-size: 13px; }
  .signatures div { text-align: center; }
  .signatures .line { display: block; margin-bottom: 6px; width: 190px; border-top: 1px solid #24324a; }

  .provenance {
    margin-top: 30px;
    padding-top: 8px;
    border-top: 1px dashed #c7cedb;
    font-family: system-ui, "Segoe UI", sans-serif;
    font-size: 10px;
    color: #64748b;
  }

  /* Reports rather than certificates: a wide table needs to stay readable. */
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }

  @media print {
    html { background: #fff; }
    body { padding: 0; }
    .sheet { max-width: none; border: 0; box-shadow: none; padding: 0; }
    .sheet--bordered { outline-offset: -6mm; }
  }
`;

/** Wrap a stored fragment into the document the frame displays and prints. */
export function documentShell(html: string, title: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<title>${escape(title)}</title>`,
    `<style>${DOCUMENT_STYLES}</style>`,
    '</head><body>',
    html,
    '</body></html>',
  ].join('');
}

/**
 * A stored report, in the sheet.
 *
 * The saved HTML is a fragment — a heading, a table, a provenance line — written by
 * the generator without any page furniture, so the sheet is added around it here
 * rather than baked into what is stored. That keeps the stored document portable and
 * means a design change to the sheet does not require rewriting every saved row.
 */
export function reportDocument(html: string): string {
  return `<div class="sheet">${html}</div>`;
}

/**
 * The Admission Confirmation certificate, filled from one real enquiry.
 *
 * Every value here comes from `admissions.listEnquiries` and
 * `admissions.getEnquiryDetails` — nothing is defaulted to a plausible-looking
 * placeholder, because a certificate that invents a division is worse than one that
 * leaves it ruled and blank.
 *
 * There is no school name in the letterhead. This application does not hold one, and
 * printing an invented institution on a document a parent receives would be a
 * fabrication rather than a formatting choice. The band is left for the school to fill
 * through Edit, or supplied by the school's own template when it has authored one.
 */
export function admissionConfirmationHtml(
  values: EnquiryValues,
  options: { schoolName?: string; issuedOn?: string } = {}
): string {
  const name = values.student_name.trim();
  const issuedOn = formatDocumentDate(options.issuedOn);
  const admissionDate = values.admission_date.trim()
    ? formatDocumentDate(values.admission_date)
    : '';

  const letterhead = options.schoolName?.trim()
    ? `<h1>${escape(options.schoolName.trim())}</h1>`
    : '<h1 class="blank" style="min-width:60%"></h1><p>School name and address</p>';

  const rows: Array<[string, string]> = [
    ['Student name', values.student_name],
    ['Enquiry number', values.enquiry_no],
    ['Class / Standard', values.standard_name],
    ['Division', values.division_name],
    ['Quota', values.quota_name],
    ['Contact number', values.mobile],
    ['Admission date', admissionDate],
    ['Current status', values.status],
  ];

  return [
    '<div class="sheet sheet--bordered">',
    `<header class="letterhead">${letterhead}</header>`,
    '<hr class="rule"><hr class="rule">',

    '<div class="doc-title">Admission Confirmation</div>',

    '<div class="meta">',
    `<span>Ref. No. ${field(values.enquiry_no || values.enquiry_id)}</span>`,
    `<span>Date: ${escape(issuedOn)}</span>`,
    '</div>',

    '<section class="body">',
    '<p>This is to certify that the admission enquiry recorded below has been reviewed ',
    'and is confirmed for enrolment in this institution. The particulars stated are ',
    'reproduced from the institution&rsquo;s admission records.</p>',
    `<p>Name of the student: <strong>${field(name)}</strong>, ` +
      `admitted to class <strong>${field(values.standard_name)}</strong>` +
      (values.division_name.trim()
        ? `, division <strong>${escape(values.division_name.trim())}</strong>`
        : '') +
      '.</p>',
    '</section>',

    '<table class="particulars"><tbody>',
    ...rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${field(value)}</td></tr>`),
    '</tbody></table>',

    '<div class="signatures">',
    '<div><span class="line"></span>Parent / Guardian</div>',
    '<div><span class="line"></span>Principal / Authorised Signatory</div>',
    '</div>',

    '<p class="provenance">',
    `Admission Confirmation for enquiry #${escape(values.enquiry_id)}. `,
    'Every field above was read from the institution&rsquo;s live admission records at ',
    `${escape(issuedOn)}. Blank fields are blank on the record.`,
    '</p>',

    '</div>',
  ].join('');
}
