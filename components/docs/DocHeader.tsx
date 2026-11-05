"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Menu, 
  X, 
  Moon, 
  Sun, 
  BookOpen, 
  Layers, 
  ChevronRight, 
  Home, 
  Compass, 
  ArrowLeft 
} from "lucide-react";
import { VersionSelector } from "./VersionSelector";
import { DocSearchModal } from "./DocSearchModal";

interface DocHeaderProps {
  version: string;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export function DocHeader({
  version,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}: DocHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

  return (
    <>
      <header className="h-16 sticky top-0 z-30 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between transition-colors">
        {/* Left: Branding & Mobile toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle navigation"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/docs/releases" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200 dark:shadow-none group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Scholar <span className="text-indigo-600 dark:text-indigo-400 font-normal">Docs</span>
              </span>
            </div>
          </Link>

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Version Selector */}
          <VersionSelector currentVersion={version} />
        </div>

        {/* Center: Search Trigger Button */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-400 text-xs transition-colors shadow-sm"
          >
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-500" />
              <span>Search documentation...</span>
            </span>
            <kbd className="font-mono text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: Actions, Themes & Portal Links */}
        <div className="flex items-center gap-2">
          {/* Mobile search button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          <Link
            href="/docs/releases"
            className="hidden lg:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Releases</span>
          </Link>

          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Scholar App</span>
          </Link>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Global search modal */}
      <DocSearchModal
        version={version}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}

