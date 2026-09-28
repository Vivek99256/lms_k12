'use client';

import { asRecord, readString, type FeesSession } from '@/app/fees/_lib/fees-api';

export type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

export function normalizePayload(response: unknown): Record<string, unknown> {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (Object.keys(nested).length > 0) {
    return {
      ...root,
      ...nested,
      data: nested.data ?? root.data,
    };
  }

  return root;
}

export function readStatus(payload: Record<string, unknown>): number {
  const rawStatus = payload.status ?? payload.status_code;
  return Number(readString(rawStatus)) || 0;
}

export function readMessage(payload: Record<string, unknown>, fallback: string): string {
  return readString(payload.message) || fallback;
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Renders a headers/rows table off-screen, rasterises it, and slices the
 * result into landscape A4 pages — the same html2canvas-pro + jsPDF
 * machinery `app/lms/exam/_assessment-blueprint/pdf.tsx` uses, applied to a
 * plain table instead of a laid-out sheet. This is the library reports'
 * equivalent of the legacy DataTables `pdfHtml5` export button.
 */
export async function exportRowsToPdf(filenameBase: string, title: string, rows: Record<string, string>[]) {
  if (typeof window === 'undefined' || rows.length === 0) return;

  const headers = Object.keys(rows[0]);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;background:#ffffff;padding:16px;';

  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.style.cssText = 'font-family:Arial,sans-serif;margin:0 0 12px;font-size:16px;';
  host.appendChild(heading);

  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;white-space:nowrap;';

  const headRow = document.createElement('tr');
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.cssText = 'border:1px solid #cbd5e1;padding:6px 8px;background:#f1f5f9;text-align:left;';
    headRow.appendChild(th);
  });
  const thead = document.createElement('thead');
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    headers.forEach((header) => {
      const td = document.createElement('td');
      td.textContent = row[header] ?? '-';
      td.style.cssText = 'border:1px solid #cbd5e1;padding:6px 8px;';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  host.appendChild(table);
  document.body.appendChild(host);

  try {
    // Loaded on demand — html2canvas and jsPDF are heavy and only needed
    // the moment someone actually exports.
    const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
      import('html2canvas-pro'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

    const pageWidthMm = 297;
    const pageHeightMm = 210;
    const marginMm = 10;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const pxPerMm = canvas.width / contentWidthMm;
    const pageHeightPx = (pageHeightMm - marginMm * 2) * pxPerMm;

    const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    let renderedHeightPx = 0;
    let pageIndex = 0;

    while (renderedHeightPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeightPx);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeightPx;
      const ctx = slice.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, renderedHeightPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

        if (pageIndex > 0) pdf.addPage('a4', 'landscape');
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', marginMm, marginMm, contentWidthMm, sliceHeightPx / pxPerMm);
      }

      renderedHeightPx += sliceHeightPx;
      pageIndex += 1;
    }

    pdf.save(`${filenameBase}.pdf`);
  } finally {
    host.remove();
  }
}

export function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatDate(value: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB').format(parsed);
}

export function formatDateTime(value: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsed);
}

export function getStoredAcademicYears(): string[] {
  if (typeof window === 'undefined') return [];

  const years = new Set<string>();
  for (const storage of [sessionStorage, localStorage]) {
    for (const key of ['userData', 'menuContext', 'sessionData', 'sessiondata', 'academicSession', 'academicData']) {
      try {
        const parsed = JSON.parse(storage.getItem(key) || '{}') as Record<string, unknown>;
        const academicYears = Array.isArray(parsed.academicYears) ? parsed.academicYears : [];
        academicYears.forEach((entry) => {
          const record = asRecord(entry);
          const year = readString(record.syear ?? record.academic_year);
          if (year) years.add(year);
        });
      } catch {
        // ignore malformed storage payloads
      }
    }
  }

  return Array.from(years).sort((left, right) => Number(right) - Number(left));
}

/**
 * The same fields `appendSessionFormData`/`appendSessionParams` attach to
 * every fetch-based call, as a plain object -- for `submitBackendPost`,
 * which builds hidden form inputs rather than a FormData/URLSearchParams.
 * Laravel's session hydration (SessionMiddleware + HydratesLegacyApiSession)
 * reads these as request fields, not an Authorization header, so a raw form
 * POST that omits them reaches Laravel with no way to authenticate.
 */
export function sessionFormFields(session: FeesSession): Record<string, string> {
  const fields: Record<string, string> = { type: 'API' };
  if (session.subInstituteId) fields.sub_institute_id = session.subInstituteId;
  if (session.academicYearId) fields.syear = session.academicYearId;
  if (session.userId) fields.user_id = session.userId;
  if (session.termId) fields.term_id = session.termId;
  if (session.token) fields.token = session.token;
  if (session.userProfileId) fields.user_profile_id = session.userProfileId;
  if (session.userProfileName) fields.user_profile_name = session.userProfileName;
  if (session.clientId) fields.client_id = session.clientId;
  return fields;
}

export function submitBackendPost(path: string, fields: Record<string, string | string[]>) {
  if (typeof window === 'undefined') return;

  const form = document.createElement('form');
  form.method = 'POST';
  // `path` names a Next.js API route (e.g. "api/proxy-file?path=...") that
  // itself forwards to Laravel -- the form must submit to this app's own
  // origin, not to API_BASE_URL (Laravel's host). Posting to the Laravel
  // host directly 404s, since routes like /api/proxy-file only exist here.
  form.action = `/${path.replace(/^\/+/, '')}`;
  form.target = '_blank';
  form.style.display = 'none';

  Object.entries(fields).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = entry;
      form.appendChild(input);
    });
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}
