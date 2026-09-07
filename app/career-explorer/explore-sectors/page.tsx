'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { CareerExplorerPageHeader } from '../_components/CareerExplorerPageHeader';
import { loadExploreSector, type ExploreSectorResponse } from '../_lib/api';

export default function ExploreSectorsPage() {
  const title = useSearchParams().get('title') ?? '';
  const [data, setData] = useState<ExploreSectorResponse>({});
  const [active, setActive] = useState('about_us');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadExploreSector(title));
    } catch (err) {
      setData({ title });
      setError(err instanceof Error ? err.message : 'Unable to load this sector.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const sections = data.data ?? [];
  const current = sections.find((section) => section.key === active) ?? sections[0];

  return (
    <div className="space-y-5 p-1 md:p-2">
      <CareerExplorerPageHeader
        icon={Layers}
        title="Explore more on sectors"
        description={(data.title ?? title) || 'Learn more about this sector.'}
        badgeIcon={Layers}
        badgeLabel="Sector deep-dive"
      />

      <Card>
        <CardHeader>
          <CardTitle>{(data.title ?? title) || 'Sector overview'}</CardTitle>
          {sections.length > 0 && (
            <CardDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                {sections.map((section) => (
                  <Button
                    key={section.key}
                    type="button"
                    variant={active === section.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActive(section.key ?? '')}
                    className={active === section.key ? 'bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90' : ''}
                  >
                    {section.value ?? section.key}
                  </Button>
                ))}
              </div>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loading && <Skeleton className="h-64 w-full rounded-xl" />}

          {!loading && error && (
            <ErrorState title="Unable to load this sector" description={error} retry={() => void refresh()} />
          )}

          {!loading && !error && (
            <div
              className="prose max-w-none text-sm leading-6 text-foreground"
              dangerouslySetInnerHTML={{ __html: current?.html ?? '<p>No content available for this sector.</p>' }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
