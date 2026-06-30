export type TableExportColumn = {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
};

export type TableExportRow = Record<string, string>;

type PrintExportOptions = {
  filename?: string;
  title: string;
  subtitle: string;
  columns: TableExportColumn[];
  rows: TableExportRow[];
};

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r?\n/g, ' ');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadBlob(filename: string, mimeType: string, content: BlobPart[]) {
  const blob = new Blob(content, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportRowsAsCsv(options: {
  filename: string;
  columns: TableExportColumn[];
  rows: TableExportRow[];
}) {
  const header = options.columns.map((column) => escapeCsvValue(column.label)).join(',');
  const lines = options.rows.map((row) =>
    options.columns
      .map((column) => escapeCsvValue(row[column.key] ?? ''))
      .join(',')
  );

  downloadBlob(options.filename, 'text/csv;charset=utf-8', ['\uFEFF', [header, ...lines].join('\r\n')]);
}

export function exportRowsAsExcel(options: {
  filename: string;
  title: string;
  columns: TableExportColumn[];
  rows: TableExportRow[];
}) {
  const colgroup = options.columns
    .map((column) => `<col style="${column.width ? `width:${column.width};` : ''}">`)
    .join('');
  const headerCells = options.columns
    .map(
      (column) =>
        `<th style="border:1px solid #cbd5e1;padding:8px;background:#eff6ff;text-align:${column.align ?? 'left'};">${escapeHtml(column.label)}</th>`
    )
    .join('');
  const bodyRows = options.rows
    .map(
      (row) =>
        `<tr>${options.columns
          .map(
            (column) =>
              `<td style="border:1px solid #cbd5e1;padding:8px;vertical-align:top;text-align:${column.align ?? 'left'};">${escapeHtml(
                row[column.key] ?? ''
              )}</td>`
          )
          .join('')}</tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body>
  <table style="border-collapse:collapse;width:100%;table-layout:fixed;font-family:Arial,sans-serif;font-size:12px;">
    <colgroup>${colgroup}</colgroup>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="${options.columns.length}" style="border:1px solid #cbd5e1;padding:8px;">No records available</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

  downloadBlob(
    options.filename,
    'application/vnd.ms-excel;charset=utf-8',
    ['\uFEFF', html]
  );
}

function buildPrintHtml(options: PrintExportOptions) {
  const colgroup = options.columns
    .map((column) => `<col style="${column.width ? `width:${column.width};` : ''}">`)
    .join('');
  const headerCells = options.columns
    .map(
      (column) =>
        `<th style="text-align:${column.align ?? 'left'};">${escapeHtml(column.label)}</th>`
    )
    .join('');
  const bodyRows = options.rows
    .map(
      (row) =>
        `<tr>${options.columns
          .map(
            (column) =>
              `<td style="text-align:${column.align ?? 'left'};">${escapeHtml(row[column.key] ?? '')}</td>`
          )
          .join('')}</tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 20px;
    }
    p {
      margin: 0 0 18px;
      color: #475569;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: #eff6ff;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 9px;
    }
    tbody tr:nth-child(even) td {
      background: #f8fafc;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(options.title)}</h1>
  <p>${escapeHtml(options.subtitle)}</p>
  <table>
    <colgroup>${colgroup}</colgroup>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="${options.columns.length}">No records available</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;
}

export function openPrintPreview(options: PrintExportOptions) {
  if (typeof window === 'undefined') {
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
    }, 1000);
  };

  iframe.onload = () => {
    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
      cleanup();
      return;
    }

    const afterPrint = () => {
      iframeWindow.removeEventListener('afterprint', afterPrint);
      cleanup();
    };

    iframeWindow.addEventListener('afterprint', afterPrint);
    iframeWindow.focus();
    window.setTimeout(() => iframeWindow.print(), 100);
  };

  iframe.srcdoc = buildPrintHtml(options);
}

export function exportRowsAsPdf(options: {
  filename: string;
  title: string;
  subtitle: string;
  columns: TableExportColumn[];
  rows: TableExportRow[];
}) {
  openPrintPreview(options);
}
