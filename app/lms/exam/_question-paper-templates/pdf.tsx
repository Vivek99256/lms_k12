'use client';

// ---------------------------------------------------------------------------
// Question paper -> PDF.
//
// The sheet is rendered off-screen at the page's real content width, measured,
// and only then rasterised. Pages are cut at block boundaries the sheet marks
// with `data-pdf-block` — never at a fixed offset — so a question, an option
// list or a section heading is never sliced in half, and a heading never ends
// up stranded at the foot of a page without its questions.
//
// Nothing is laid out twice: the same QuestionPaperSheet the preview shows is
// what goes into the PDF, so what a teacher sees is what they get.
// ---------------------------------------------------------------------------

import { createRoot } from 'react-dom/client';
import QuestionPaperSheet from './QuestionPaperSheet';
import { PAGE_SIZES_MM, PX_PER_MM, computePageCuts, marginToMm } from '@/lib/question-paper/pagination';
import { resolvePaper } from './resolve';
import type { Blueprint, PaperContext, SchoolBranding } from './types';

/**
 * The school logo is served from the ERP host, which would taint the canvas
 * and make the whole export throw. Inline it first; if that fails the paper
 * prints without the logo rather than not printing at all.
 */
async function inlineLogo(url: string | null): Promise<string | null> {
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

async function waitForPaint(host: HTMLElement): Promise<void> {
  // Two frames: one for React to commit, one for layout to settle.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const images = Array.from(host.querySelectorAll('img'));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) return resolve();
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        })
    )
  );

  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    } catch {
      /* font loading is best-effort */
    }
  }
}

/**
 * Where each page ends, in sheet pixels.
 *
 * Candidate cuts are the tops of the marked blocks, so a page break always
 * lands in the gap between two blocks. A block taller than a whole page is the
 * only case that forces a hard cut, and then it is cut at the page boundary
 * because there is nowhere better to put it.
 */
function findPageCuts(sheet: HTMLElement, pageHeightPx: number): Array<[number, number]> {
  const sheetRect = sheet.getBoundingClientRect();

  const tops = Array.from(sheet.querySelectorAll<HTMLElement>('[data-pdf-block]')).map(
    (block) => block.getBoundingClientRect().top - sheetRect.top
  );

  return computePageCuts(tops, sheetRect.height, pageHeightPx);
}

export type QuestionPaperPdfOptions = {
  blueprint: Blueprint;
  context: PaperContext;
  branding: SchoolBranding;
  /** Base name for the file, without extension. */
  fileName: string;
  /** 'open' shows the PDF in a new tab, falling back to a download. */
  action?: 'open' | 'save';
};

export async function generateQuestionPaperPdf({
  blueprint,
  context,
  branding,
  fileName,
  action = 'open',
}: QuestionPaperPdfOptions): Promise<void> {
  const { page } = blueprint;
  const [shortMm, longMm] = PAGE_SIZES_MM[page.size.toLowerCase()] ?? PAGE_SIZES_MM.a4;
  const landscape = page.orientation === 'landscape';
  const pageWidthMm = landscape ? longMm : shortMm;
  const pageHeightMm = landscape ? shortMm : longMm;

  const marginMm = Math.min(marginToMm(page.margin), Math.min(pageWidthMm, pageHeightMm) / 3);
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;

  const contentWidthPx = contentWidthMm * PX_PER_MM;
  const pageHeightPx = contentHeightMm * PX_PER_MM;

  const resolved = resolvePaper(blueprint, context, {
    ...branding,
    logoUrl: await inlineLogo(branding.logoUrl),
  });

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
    root.render(<QuestionPaperSheet paper={resolved} page={page} />);

    await waitForPaint(host);

    const sheet = host.querySelector<HTMLElement>('.question-paper-sheet');

    if (!sheet) {
      throw new Error('The question paper could not be laid out for export.');
    }

    const pages = findPageCuts(sheet, pageHeightPx);

    // Loaded on demand -- html2canvas and jsPDF are heavy and only needed the
    // moment someone actually exports, the same way the template editor does it.
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

    const pdf = new JsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageWidthMm, pageHeightMm],
    });

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

      if (pageIndex > 0) pdf.addPage([pageWidthMm, pageHeightMm], landscape ? 'landscape' : 'portrait');

      pdf.addImage(
        slice.toDataURL('image/jpeg', 0.95),
        'JPEG',
        marginMm,
        marginMm,
        contentWidthMm,
        (bottom - top) / PX_PER_MM
      );

      if (blueprint.footer.showPageNumbers) {
        pdf.setFontSize(9);
        pdf.setTextColor(90);
        pdf.text(
          `${pageIndex + 1} / ${pages.length}`,
          pageWidthMm / 2,
          pageHeightMm - marginMm / 2,
          { align: 'center' }
        );
      }
    });

    const safeName = `${fileName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'question-paper'}.pdf`;

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
