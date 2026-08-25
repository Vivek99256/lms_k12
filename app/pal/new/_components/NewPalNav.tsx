'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, LayoutGrid, Share2, type LucideIcon } from 'lucide-react';

/**
 * New PAL's sub-module bar.
 *
 * New PAL is a level-2 entry under LMS + PAL and links straight to its
 * workspace, so its sub-modules are navigated here. This is the
 * `module → sub-module` level of the IA: the sidebar picks New PAL, this bar
 * picks the sub-module inside it.
 *
 * Content Model is the first sub-module. Others are added to SUB_MODULES as
 * they ship; an entry with `available: false` is shown but not linked, so the
 * roadmap is visible without pretending a page exists.
 */

export interface SubModule {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  available: boolean;
}

export const SUB_MODULES: SubModule[] = [
  {
    key: 'content-model',
    label: 'Content model',
    href: '/pal/new/content-model',
    icon: Boxes,
    description:
      'The 4-type content model, Bloom ladder, metadata schema and misconception library, projected from extracted chapter intelligence.',
    available: true,
  },
  {
    key: 'coherence-map',
    label: 'Coherence map',
    href: '/pal/new/coherence-map',
    icon: Share2,
    description:
      'The concept prerequisite graph read out of Neo4j — what each concept needs before it, what it unlocks after it, and what is attached to teach and assess it.',
    available: true,
  },
];

export default function NewPalNav() {
  const pathname = (usePathname() || '').toLowerCase();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DFE6F2] bg-white px-3 py-2.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        New PAL
      </span>

      <Link href="/pal/new">
        <button
          type="button"
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            pathname === '/pal/new'
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Overview
        </button>
      </Link>

      {SUB_MODULES.map((sub) => {
        const Icon = sub.icon;
        const active = pathname.startsWith(sub.href);

        if (!sub.available) {
          return (
            <span
              key={sub.key}
              title="Not built yet"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-400"
            >
              <Icon className="h-3.5 w-3.5" />
              {sub.label}
            </span>
          );
        }

        return (
          <Link key={sub.key} href={sub.href}>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {sub.label}
            </button>
          </Link>
        );
      })}
    </div>
  );
}
