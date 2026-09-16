'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { DocumentSourceTable } from '@/app/documents/_components/document-source-table';
import { canAccessDocuments } from '@/app/documents/_lib/document-access';

/**
 * One document source, listed.
 *
 * The `source` segment is a REGISTRY KEY, not a table name — the backend
 * resolves it against config/documents.php and answers 404 for anything it does
 * not recognise, so an unknown segment can never reach a query.
 */
export default function DocumentSourcePage({
  params,
}: {
  params: Promise<{ source: string }>;
}) {
  const { source } = use(params);
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  // Same backstop as /documents — a deep link must not bypass the dashboard's
  // guard. Laravel refuses the endpoints regardless.
  useEffect(() => {
    if (canAccessDocuments()) {
      setState('allowed');
    } else {
      setState('denied');
      router.replace('/dashboard');
    }
  }, [router]);

  if (state !== 'allowed') return null;

  return <DocumentSourceTable sourceKey={source} />;
}
