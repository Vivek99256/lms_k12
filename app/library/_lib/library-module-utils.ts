'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';
import { asRecord, readString } from '@/app/fees/_lib/fees-api';

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

export function submitBackendPost(path: string, fields: Record<string, string | string[]>) {
  if (typeof window === 'undefined') return;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`;
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
