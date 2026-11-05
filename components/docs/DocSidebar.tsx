"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown, Folder, FileText } from "lucide-react";
import { DocNavItem } from "@/lib/docs/docs-types";

interface DocSidebarProps {
  items: DocNavItem[];
  version: string;
}

function SidebarFolder({ item, currentPath }: { item: DocNavItem; currentPath: string }) {
  const isDescendantActive = (node: DocNavItem): boolean => {
    if (node.href === currentPath) return true;
    if (node.children) {
      return node.children.some(isDescendantActive);
    }
    return false;
  };

  const initiallyOpen = isDescendantActive(item);
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group"
      >
        <span className="flex items-center gap-2 truncate">
          <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0 group-hover:text-indigo-600" />
          <span className="truncate">{item.title}</span>
        </span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
      </button>

      {isOpen && item.children && item.children.length > 0 && (
        <div className="ml-3 pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-1">
          {item.children.map((child) => (
            <React.Fragment key={child.href}>
              {child.children && child.children.length > 0 ? (
                <SidebarFolder item={child} currentPath={currentPath} />
              ) : (
                <SidebarFile item={child} currentPath={currentPath} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarFile({ item, currentPath }: { item: DocNavItem; currentPath: string }) {
  const isActive = currentPath === item.href;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate ${
        isActive
          ? "bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200 dark:shadow-none"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
      }`}
    >
      <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

export function DocSidebar({ items, version }: DocSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-[calc(100vh-4rem)] sticky top-16 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          v{version}
        </span>
      </div>

      <nav className="space-y-1">
        {items.map((item) => (
          <React.Fragment key={item.href}>
            {item.children && item.children.length > 0 ? (
              <SidebarFolder item={item} currentPath={pathname} />
            ) : (
              <SidebarFile item={item} currentPath={pathname} />
            )}
          </React.Fragment>
        ))}
      </nav>
    </aside>
  );
}
