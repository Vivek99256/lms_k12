'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/** Centered card used by every signed-out portal page (sign in, register, reset, invitation, email confirmation). */
export function PortalCard({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600">Alumni portal</p>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {intro ? <p className="mt-1 text-sm text-slate-600">{intro}</p> : null}
        <div className="mt-5 space-y-4">{children}</div>
      </section>
      {footer ? <div className="mt-4 text-center text-sm text-slate-600">{footer}</div> : null}
    </main>
  );
}

export function PortalLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium text-indigo-700 hover:underline">{children}</Link>;
}

export const PASSWORD_HINT = 'At least 10 characters, with a letter and a number.';

/** First field error from a PortalApiError-style map, for showing under an input. */
export const firstError = (errors: Record<string, string[]>, key: string): string | undefined => errors[key]?.[0];
