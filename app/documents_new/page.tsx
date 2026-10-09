'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { IdmsLibrary } from '@/app/documents/_components/idms-library';
import { canAccessDocuments } from '@/app/documents/_lib/document-access';

/**
 * Intelligent Document Management System — mounted at `/documents_new`.
 *
 * WHY A SEPARATE ROUTE. `/documents` is the pre-existing aggregation dashboard
 * that reads counts out of tables other modules own, and `/documents/[source]`
 * still hangs off it. Nothing in that screen was changed or removed; this module
 * was given its own path instead of displacing it, so both remain reachable and
 * no existing bookmark or menu entry breaks.
 *
 * This screen is a different thing entirely: it lists document_master rows
 * directly, and upload, automatic classification, tagging, full-text search and
 * the virtual browse tree all read and write that one table. Permissions are
 * applied inside the search query rather than after it, so a restricted document
 * cannot leak through a count, a tree number or a snippet.
 *
 * The guard below is the client-side backstop for direct URL navigation, in the
 * same spirit as app/lms/_shared/RequireStaff.tsx and identical to the one on
 * /documents. It is NOT the access control: Laravel refuses every endpoint
 * independently, so a user who defeats this sees an empty screen and 403s
 * rather than anybody's documents.
 */
export default function DocumentsNewPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    /*
     * Both setState calls below are deliberate. canAccessDocuments() reads
     * localStorage, so it is false during SSR and only meaningful after
     * hydration; a lazy useState initializer would render 'denied' on the server
     * and 'allowed' on the client, which is a hydration mismatch.
     */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (canAccessDocuments()) {
      setState('allowed');
    } else {
      setState('denied');
      router.replace('/dashboard');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);

  if (state !== 'allowed') return null;

  return <IdmsLibrary />;
}
