"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, History, Sparkles } from "lucide-react";
import { AVAILABLE_VERSIONS, DocVersionMeta } from "@/lib/docs/docs-types";

interface VersionSelectorProps {
  currentVersion: string;
}

export function VersionSelector({ currentVersion }: VersionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const activeMeta = AVAILABLE_VERSIONS.find((v) => v.version === currentVersion) || AVAILABLE_VERSIONS[0];

  const handleSelect = (version: string) => {
    setIsOpen(false);
    router.push(`/docs/${version}`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
      >
        <span className="flex items-center gap-1.5">
          {activeMeta.isLatest && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
          <span>{activeMeta.label}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-between">
              <span>DOCUMENTATION RELEASES</span>
              <History className="w-3.5 h-3.5" />
            </div>
            <div className="mt-1 space-y-1">
              {AVAILABLE_VERSIONS.map((v) => {
                const isSelected = v.version === currentVersion;
                return (
                  <button
                    key={v.version}
                    onClick={() => handleSelect(v.version)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>{v.label}</span>
                        {v.isLatest && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Released: {v.releaseDate}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800/80 mt-1 pt-1">
              <Link
                href="/docs/releases"
                onClick={() => setIsOpen(false)}
                className="block text-center text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline py-1 font-medium"
              >
                View all release changelogs →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
