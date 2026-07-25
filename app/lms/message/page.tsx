'use client';

import { MessageSquare } from 'lucide-react';

/**
 * LMS → Message.
 *
 * The Laravel source (`lmsCommunicationController` + `show_lmsCommunication.blade.php`)
 * is a placeholder only — it has no controller logic, no database table, and no
 * real fields (just hard-coded demo cards). There is therefore no data to
 * integrate. Rather than fabricate content, this page honestly reflects that the
 * feature is not yet available on the backend, so the menu link still resolves
 * instead of 404-ing. Build out the UI once a real messaging API/data model exists.
 */
export default function LmsMessagePage() {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[900px] space-y-5">
        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <MessageSquare className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Message</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Notifications, messages and chat for the LMS.
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <MessageSquare className="mx-auto mb-3 size-9 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">Not yet available</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            The LMS Message module does not have a backend data source yet — it exists only as a
            placeholder in the legacy system. Once a messaging API and data model are defined, this
            screen will surface real notifications, messages and chat.
          </p>
        </div>
      </div>
    </div>
  );
}
