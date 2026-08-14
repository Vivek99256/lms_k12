import { redirect } from 'next/navigation';

function queryStringFromSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) query.append(key, entry);
      });
      return;
    }
    if (value) query.set(key, value);
  });
  return query.toString();
}

export default async function PalContentModelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const queryString = queryStringFromSearchParams(resolvedSearchParams);
  redirect(queryString ? `/pal/frameworks?${queryString}` : '/pal/frameworks');
}



