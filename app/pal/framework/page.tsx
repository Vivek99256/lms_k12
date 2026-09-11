import { redirect } from 'next/navigation';

import { queryStringFromSearchParams } from '@/app/pal/_lib/searchParams';

/**
 * Legacy singular path. The canonical route is /pal/frameworks, which is what
 * the `new_pal.frameworks` menu row and routeMapper point at; this shim keeps
 * older links working and carries the chapter/concept context across.
 */
export default async function LegacyFrameworkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryString = queryStringFromSearchParams(await searchParams);

  redirect(queryString ? `/pal/frameworks?${queryString}` : '/pal/frameworks');
}
