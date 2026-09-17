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
import {
  extractImageSrcs,
  isInlineableUrl,
  isPrintableImageDataUri,
  rewriteImageSrcs,
} from '@/lib/question-paper/images';
import { resolvePaper } from './resolve';
import type { Blueprint, PaperContext, ResolvedPaper, SchoolBranding } from './types';

/**
 * One remote image as a `data:` URI, or null if it cannot be had.
 *
 * Two attempts, in order. A direct CORS fetch is tried first because it is one
 * round trip and needs nothing configured. When the asset host serves no CORS
 * headers the browser refuses to let the page read those bytes at all, and the
 * same-origin proxy is the only way to get them onto a clean canvas — so that
 * is the fallback, not the default.
 *
 * Returning null rather than throwing is deliberate: a paper that prints
 * without one diagram is a problem, and a paper that does not print at all is
 * a worse one.
 */
async function fetchAsDataUri(url: string): Promise<string | null> {
  // Already local — a school that stores its logo inline, or an image the
  // extractor embedded rather than linked.
  if (url.startsWith('data:')) return url;

  const read = async (target: string, mode: RequestMode) => {
    const response = await fetch(target, { mode, cache: 'force-cache' });

    if (!response.ok) return null;

    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  };

  try {
    const direct = await read(url, 'cors');
    if (direct) return direct;
  } catch {
    /* falls through to the proxy */
  }

  try {
    return await read(`/api/question-paper/asset?url=${encodeURIComponent(url)}`, 'same-origin');
  } catch {
    return null;
  }
}

/** Fetch each url once, however many questions use it. */
async function inlineMany(urls: readonly string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(urls.filter(isInlineableUrl)));

  if (unique.length === 0) return {};

  const results = await Promise.all(
    unique.map(async (url) => [url, await fetchAsDataUri(url)] as const)
  );

  const map: Record<string, string> = {};

  for (const [url, dataUri] of results) {
    // A data URI the sheet's sanitiser would strip is worse than the original
    // url, so only the printable ones replace anything.
    if (dataUri && isPrintableImageDataUri(dataUri)) {
      map[url] = dataUri;
    }
  }

  return map;
}

/**
 * The same paper with every remote image held locally.
 *
 * Both places a picture can live are covered: the `figures` rows attached to a
 * question, and any `<img>` inside the question's own stored HTML or an
 * option's. Whatever could not be fetched keeps its original url, so the
 * preview-identical layout is preserved and only that one image is missing
 * from the raster.
 */
async function inlinePaperImages(paper: ResolvedPaper): Promise<ResolvedPaper> {
  const urls: string[] = [];

  for (const section of paper.sections) {
    for (const placed of section.questions) {
      urls.push(...(placed.question.figures ?? []).map((figure) => figure.url));
      urls.push(...extractImageSrcs(placed.question.question_title));

      for (const option of placed.question.options) {
        urls.push(...extractImageSrcs(option.text));
      }
    }
  }

  const inlined = await inlineMany(urls);

  if (Object.keys(inlined).length === 0) return paper;

  return {
    ...paper,
    sections: paper.sections.map((section) => ({
      ...section,
      questions: section.questions.map((placed) => ({
        ...placed,
        question: {
          ...placed.question,
          question_title: rewriteImageSrcs(placed.question.question_title, inlined),
          figures: (placed.question.figures ?? []).map((figure) => ({
            ...figure,
            url: inlined[figure.url] ?? figure.url,
          })),
          options: placed.question.options.map((option) => ({
            ...option,
            text: rewriteImageSrcs(option.text, inlined),
          })),
        },
      })),
    })),
  };
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

  // Every picture on the paper is pulled local before anything is rendered:
  // the letterhead, each question's figures, and any image inside the stored
  // question or option HTML. html2canvas can only read back a canvas whose
  // pixels all came from somewhere this page may read, so a remote image left
  // remote is a blank gap in the PDF -- or an export that throws outright.
  const resolved = await inlinePaperImages(
    resolvePaper(blueprint, context, {
      ...branding,
      logoUrl: branding.logoUrl ? await fetchAsDataUri(branding.logoUrl) : null,
    })
  );

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
