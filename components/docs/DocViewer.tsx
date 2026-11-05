"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Check, ChevronLeft, ChevronRight, FileText, Calendar, Sparkles } from "lucide-react";

interface DocViewerProps {
  title: string;
  version: string;
  htmlContent: string;
  prevDoc?: { title: string; href: string } | null;
  nextDoc?: { title: string; href: string } | null;
  meta?: Record<string, any>;
}

export function DocViewer({
  title,
  version,
  htmlContent,
  prevDoc,
  nextDoc,
  meta,
}: DocViewerProps) {
  const [copied, setCopied] = useState<string | null>(null);

  // Wrap tables in responsive scroll containers and setup client-side copy buttons
  useEffect(() => {
    // 1. Wrap every table in an overflow-x-auto container if not already wrapped
    const tables = document.querySelectorAll(".doc-prose table");
    tables.forEach((table) => {
      if (table.parentElement?.classList.contains("doc-table-wrapper")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "doc-table-wrapper my-6 w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm";
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    // 2. Setup client-side copy buttons for any code block rendered in htmlContent
    const preBlocks = document.querySelectorAll(".doc-prose pre");
    preBlocks.forEach((pre, index) => {
      if (pre.querySelector(".copy-code-btn")) return;

      const btn = document.createElement("button");
      btn.className =
        "copy-code-btn absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/80 hover:bg-slate-600 text-slate-300 text-xs flex items-center gap-1 transition-all opacity-80 hover:opacity-100 shadow-sm";
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span>`;

      (pre as HTMLElement).style.position = "relative";
      pre.appendChild(btn);

      btn.addEventListener("click", () => {
        const code = pre.querySelector("code")?.innerText || pre.innerText;
        navigator.clipboard.writeText(code);
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span style="color:#22c55e">Copied</span>`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy</span>`;
        }, 2000);
      });
    });
  }, [htmlContent]);

  return (
    <div className="flex-1 min-w-0 w-full max-w-5xl py-6 px-4 sm:px-8">
      {/* Top Meta Header */}
      <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            Scholar Documentation v{version}
          </span>
          {meta?.last_updated && (
            <span className="flex items-center gap-1 text-[11px]">
              <Calendar className="w-3 h-3 text-slate-400" />
              Updated {meta.last_updated}
            </span>
          )}
        </div>

        {meta?.description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {meta.description}
          </p>
        )}
      </div>

      {/* Main HTML Markdown Content */}
      <article
        className="doc-prose prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* Document Navigation: Previous / Next */}
      <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {prevDoc ? (
          <Link
            href={prevDoc.href}
            className="group flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-all text-left"
          >
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">
              <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Previous
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
              {prevDoc.title}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {nextDoc ? (
          <Link
            href={nextDoc.href}
            className="group flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-all text-right sm:ml-auto w-full"
          >
            <span className="flex items-center justify-end gap-1 text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1">
              Next
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
              {nextDoc.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

