'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { DocumentsDashboard } from '@/app/documents/_components/documents-dashboard';
import { canAccessDocuments } from '@/app/documents/_lib/document-access';

/**
 * Document module — the card dashboard.
 *
 * Mounted at `/documents` in the App Router. This is an aggregation layer: every
 * count and every row comes from a table another module already owns and writes.
 * Nothing here uploads, edits or deletes, and no existing document flow changes
 * because this screen exists.
 *
 * The guard below is the client-side backstop for direct URL navigation, in the
 * same spirit as app/lms/_shared/RequireStaff.tsx. It is NOT the access control:
 * Laravel refuses every endpoint independently, so a user who defeats this sees
 * an empty screen and three 403s rather than anybody's documents.
 */
export default function DocumentsPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (canAccessDocuments()) {
      setState('allowed');
    } else {
      setState('denied');
      router.replace('/dashboard');
    }
  }, [router]);

  if (state !== 'allowed') return null;

  return <DocumentsDashboard />;
}
