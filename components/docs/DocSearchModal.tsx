"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, BookOpen, Layers, ExternalLink } from "lucide-react";

interface SearchResult {
  title: string;
  version: string;
  href: string;
  excerpt: string;
  category: string;
}

interface DocSearchModalProps {
  version: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DocSearchModal({ version, isOpen, onClose }: DocSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/docs/search?version=${encodeURIComponent(version)}&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error("Doc search failed", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, version]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search v${version} documentation (e.g. "Admissions", "Fees", "RBAC")...`}
            className="flex-1 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-base"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800">
            v{version}
          </span>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              Searching indexed documentation...
            </div>
          )}

          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              No documentation pages found for <span className="font-semibold text-slate-600 dark:text-slate-300">"{query}"</span> in release v{version}.
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-indigo-400 mb-2 opacity-80" />
              <p>Type at least 2 characters to search across all modules, routes, schemas and APIs.</p>
              <p className="text-xs text-slate-400">Includes core, learn, ccb, insight, compass and shared platform.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
                {results.length} Results in Release v{version}
              </div>
              {results.map((res, idx) => (
                <button
                  key={`${res.href}-${idx}`}
                  onClick={() => {
                    onClose();
                    router.push(res.href);
                  }}
                  className="w-full text-left p-3 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-slate-700 group flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                        {res.title}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                        {res.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {res.excerpt}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>Navigate: <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">↑</kbd> <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">↓</kbd></span>
            <span>Select: <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">↵</kbd></span>
          </div>
          <span>Scholar Unified Search</span>
        </div>
      </div>
    </div>
  );
}

