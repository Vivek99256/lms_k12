'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flag, LoaderCircle, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CareerExplorerTabBar } from '../_components/CareerExplorerTabBar';
import { ProfileImage } from '../_components/ProfileImage';
import { loadInstitutes } from '../_lib/api';
import type { InstituteItem } from '../_lib/types';

export default function CollegeProfileHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [colleges, setColleges] = useState<InstituteItem[]>([]);
  const [searchInput, setSearchInput] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setColleges(await loadInstitutes());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load colleges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(
    () => colleges.filter((item) => (item.college_name ?? '').toLowerCase().includes(searchInput.toLowerCase())),
    [colleges, searchInput]
  );

  return (
    <div className="container mx-auto px-4">
      <CareerExplorerTabBar />

      <section className="mb-10 overflow-hidden rounded-[10px] bg-[#0D6EFD] pt-4 md:rounded-[48px] md:pt-8">
        <div className="rounded-t-[26px] bg-card px-4 py-5 md:rounded-t-[48px] md:px-10 md:py-6">
          <h1 className="py-3 text-[26px] font-semibold text-[#0D6EFD] underline md:text-4xl">
            Explore Your Future College&apos;s
          </h1>
          <p className="text-lg text-muted-foreground md:text-2xl">
            Students can explore which university and suburbs are suitable for your future.
          </p>
        </div>

        <div className="bg-card px-4 pb-8 md:px-10">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="mt-3 h-[45px] w-full rounded-[10px] border border-input bg-background px-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search by College Name"
            type="text"
          />

          {loading && (
            <div className="mt-10 flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading colleges...
            </div>
          )}

          {!loading && error && (
            <div className="mt-10 flex min-h-32 flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-lg text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw />
                Try again
              </Button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="mt-10 flex h-[200px] items-center justify-center text-muted-foreground">No colleges found.</div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {filtered.map((item, index) => <CollegeCard key={`${item.id ?? item.college_name}-${index}`} item={item} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CollegeCard({ item }: { item: InstituteItem }) {
  return (
    <article className="w-full rounded-lg border bg-background p-4 shadow-md transition hover:shadow-lg hover:shadow-blue-500/50">
      <h2 className="mb-3 break-words text-lg font-bold text-[#0D6EFD]">{item.college_name}</h2>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <span className="w-fit rounded-sm bg-yellow-200 px-2 py-1 text-xs text-black">Featured</span>
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-[#b9b7e8]" /><span>{[item.district, item.state].filter(Boolean).join(', ') || 'N/A'}</span></div>
          <div className="flex items-center gap-2"><Flag className="size-4 shrink-0 text-[#b9b7e8]" /><span>{item.type ?? 'N/A'}</span></div>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="font-bold text-foreground">Minority</dt><dd>{item.minority || 'null'}</dd></div>
        <div className="flex justify-between gap-4"><dt className="font-bold text-foreground">Level</dt><dd className="text-right">{item.level || 'null'}</dd></div>
        <div className="flex justify-between gap-4"><dt className="font-bold text-foreground">Women</dt><dd>{item.women || 'null'}</dd></div>
      </dl>
    </article>
  );
}