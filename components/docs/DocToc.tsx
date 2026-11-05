"use client";

import React, { useEffect, useState } from "react";
import { AlignRight } from "lucide-react";
import { DocTocItem } from "@/lib/docs/docs-types";

interface DocTocProps {
  toc: DocTocItem[];
}

export function DocToc({ toc }: DocTocProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!toc || toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -70% 0px" }
    );

    toc.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [toc]);

  if (!toc || toc.length === 0) {
    return null;
  }

  return (
    <div className="w-56 shrink-0 hidden xl:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <AlignRight className="w-3.5 h-3.5 text-indigo-500" />
        <span>On this page</span>
      </div>

      <nav className="space-y-1 text-xs border-l border-slate-200 dark:border-slate-800 pl-3">
        {toc.map((item) => {
          const isActive = activeId === item.id;
          const indentClass =
            item.level === 3 ? "ml-2.5" : item.level === 4 ? "ml-5" : "";

          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`block py-1 transition-colors leading-snug truncate ${indentClass} ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-semibold border-l-2 -ml-[13px] pl-[11px] border-indigo-600 dark:border-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {item.text}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
