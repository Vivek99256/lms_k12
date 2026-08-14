'use client';

/**
 * Print a DOM node (report card / result sheet) in a hidden iframe,
 * preserving the legacy `printDiv(...)` behaviour of the Blade screens.
 */
export function printElement(element: HTMLElement | null, title = 'Print') {
  if (!element || typeof window === 'undefined') return;

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

  const cleanup = () => window.setTimeout(() => iframe.remove(), 1000);

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) return cleanup();
    const afterPrint = () => {
      frameWindow.removeEventListener('afterprint', afterPrint);
      cleanup();
    };
    frameWindow.addEventListener('afterprint', afterPrint);
    frameWindow.focus();
    window.setTimeout(() => frameWindow.print(), 150);
  };

  iframe.srcdoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 24px; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  h1, h2, h3 { margin: 0 0 8px; }
  img { max-width: 100%; }
  @media print { body { margin: 0; } }
  /* Each generated report card is a sibling <div id="{student_id}"> block
     (one per selected student) — force each onto its own printed page. */
  body > * > div[id] { page-break-after: always; break-after: page; page-break-inside: avoid; }
  body > * > div[id]:last-child { page-break-after: auto; break-after: auto; }
</style>
</head>
<body>${element.outerHTML}</body>
</html>`;
}
