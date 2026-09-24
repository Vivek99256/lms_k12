'use client';

// ---------------------------------------------------------------------------
// Blueprint -> PDF.
//
// The same machinery the question-paper exporter uses, and deliberately so:
// render the sheet off-screen at the page's real content width, measure it,
// rasterise once, then cut it into pages at the `data-pdf-block` boundaries the
// sheet marks. Cutting at a fixed offset would slice a table row in half and
// strand headings at the foot of a page.
//
// A blueprint has no page setup of its own — unlike a question paper template,
// which stores its own size, orientation and margins — so A4 portrait is the
// assumption here. That is what a school prints a design on, and a blueprint
// long enough to need landscape has bigger problems.
//
// Nothing is laid out twice: the preview shows the same BlueprintSheet at the
// same width, so what is on screen is what comes out.
// ---------------------------------------------------------------------------

import { createRoot } from 'react-dom/client';
import BlueprintSheet, { type SheetBranding } from './BlueprintSheet';
import { PAGE_SIZES_MM, PX_PER_MM, computePageCuts } from '@/lib/question-paper/pagination';
import type { Blueprint } from './types';

const [A4_WIDTH_MM, A4_HEIGHT_MM] = PAGE_SIZES_MM.a4;
const MARGIN_MM = 14;

export const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;

/** The on-screen width the preview uses, so it matches the printed page exactly. */
export const PREVIEW_WIDTH_PX = Math.round(CONTENT_WIDTH_MM * PX_PER_MM);

async function waitForPaint(host: HTMLElement): Promise<void> {
  // Two frames: one for React to commit, one for layout to settle.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );

  await Promise.all(
    Array.from(host.querySelectorAll('img')).map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) return resolve();
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        })
    )
  );
}

function findPageCuts(sheet: HTMLElement, pageHeightPx: number): Array<[number, number]> {
  const sheetRect = sheet.getBoundingClientRect();

  const tops = Array.from(sheet.querySelectorAll<HTMLElement>('[data-pdf-block]')).map(
    (block) => block.getBoundingClientRect().top - sheetRect.top
  );

  return computePageCuts(tops, sheetRect.height, pageHeightPx);
}

/**
 * A school logo served from another host cannot be read back off the canvas,
 * so it is pulled local first. Returning null rather than throwing is
 * deliberate: a blueprint that prints without its letterhead is a small
 * problem, one that refuses to print at all is a bigger one.
 */
async function logoAsDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });

    if (!response.ok) return null;

    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export type BlueprintPdfOptions = {
  blueprint: Blueprint;
  branding: SheetBranding;
  /** 'open' shows the PDF in a new tab, falling back to a download. */
  action?: 'open' | 'save';
};

export async function generateBlueprintPdf({
  blueprint,
  branding,
  action = 'open',
}: BlueprintPdfOptions): Promise<void> {
  const contentWidthPx = CONTENT_WIDTH_MM * PX_PER_MM;
  const pageHeightPx = (A4_HEIGHT_MM - MARGIN_MM * 2) * PX_PER_MM;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${contentWidthPx}px`,
    'background:#ffffff',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');

  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    root.render(
      <BlueprintSheet
        blueprint={blueprint}
        branding={{ ...branding, logoUrl: await logoAsDataUri(branding.logoUrl) }}
      />
    );

    await waitForPaint(host);

    const sheet = host.querySelector<HTMLElement>('.blueprint-sheet');

    if (!sheet) {
      throw new Error('The blueprint could not be laid out for export.');
    }

    const pages = findPageCuts(sheet, pageHeightPx);

    // Loaded on demand — html2canvas and jsPDF are heavy and only needed the
    // moment someone actually exports.
    const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
      import('html2canvas-pro'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.ceil(contentWidthPx),
    });

    const sheetHeightPx = sheet.getBoundingClientRect().height;
    const canvasScale = sheetHeightPx > 0 ? canvas.height / sheetHeightPx : 1;

    const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [A4_WIDTH_MM, A4_HEIGHT_MM] });

    pages.forEach(([top, bottom], pageIndex) => {
      const sliceHeightPx = Math.max(1, Math.round((bottom - top) * canvasScale));

      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeightPx;

      const ctx = slice.getContext('2d');

      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(
        canvas,
        0,
        Math.round(top * canvasScale),
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );

      if (pageIndex > 0) pdf.addPage([A4_WIDTH_MM, A4_HEIGHT_MM], 'portrait');

      pdf.addImage(
        slice.toDataURL('image/jpeg', 0.95),
        'JPEG',
        MARGIN_MM,
        MARGIN_MM,
        CONTENT_WIDTH_MM,
        (bottom - top) / PX_PER_MM
      );

      pdf.setFontSize(8.5);
      pdf.setTextColor(150);
      pdf.text(
        `${pageIndex + 1} / ${pages.length}`,
        A4_WIDTH_MM / 2,
        A4_HEIGHT_MM - MARGIN_MM / 2,
        { align: 'center' }
      );
    });

    const safeName =
      `${blueprint.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'blueprint'}.pdf`;

    if (action === 'save') {
      pdf.save(safeName);

      return;
    }

    const blobUrl = pdf.output('bloburl') as unknown as string;
    const opened = window.open(blobUrl, '_blank');

    // A blocked pop-up must not look like a failed export.
    if (!opened) pdf.save(safeName);
  } finally {
    root.unmount();
    host.remove();
  }
}
