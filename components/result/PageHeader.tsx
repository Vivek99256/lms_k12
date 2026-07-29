'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Toaster } from './toast';

export type Crumb = { label: string; href?: string };

/**
 * Standard page chrome for every Result screen: breadcrumb trail,
 * icon + title + subtitle, right-aligned actions, and the toast outlet.
 */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  const trail: Crumb[] = breadcrumbs ?? [{ label: 'Result', href: '/result' }, { label: title }];

  return (
    <div className="space-y-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
        {trail.map((crumb, index) => (
          <React.Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden="true" />}
            {crumb.href ? (
              <Link href={crumb.href} className="rounded transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-slate-700">
                {crumb.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <Toaster />
    </div>
  );
}
