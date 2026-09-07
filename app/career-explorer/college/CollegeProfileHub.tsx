'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flag, GraduationCap, MapPin, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { CareerExplorerPageHeader } from '../_components/CareerExplorerPageHeader';
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  const filtered = useMemo(
    () => colleges.filter((item) => (item.college_name ?? '').toLowerCase().includes(searchInput.toLowerCase())),
    [colleges, searchInput]
  );

  return (
    <div className="space-y-5 p-1 md:p-2">
      <CareerExplorerPageHeader
        icon={GraduationCap}
        title="College profile"
        description="Explore colleges and universities that suit your future — search by name below."
        badgeIcon={GraduationCap}
        badgeLabel="Higher education"
      />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Colleges</CardTitle>
            <CardDescription>{loading ? 'Loading…' : `${filtered.length} college${filtered.length === 1 ? '' : 's'} found.`}</CardDescription>
          </div>
          <div className="w-full sm:w-72 lg:w-[420px]">
            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by college name"
              icon={<Search className="size-4" />}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[...Array(4)].map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)}
            </div>
          )}

          {!loading && error && (
            <ErrorState title="Unable to load colleges" description={error} retry={() => void refresh()} />
          )}

          {!loading && !error && filtered.length === 0 && (
            <EmptyState icon={<GraduationCap className="size-8" />} title="No colleges found" description="Try a different search term." />
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filtered.map((item, index) => <CollegeCard key={`${item.id ?? item.college_name}-${index}`} item={item} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CollegeCard({ item }: { item: InstituteItem }) {
  return (
    <Card size="sm" className="transition-shadow hover:shadow-md">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-[#0D6EFD]">{item.college_name}</CardTitle>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Featured</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><MapPin className="size-4 shrink-0" />{[item.district, item.state].filter(Boolean).join(', ') || 'N/A'}</span>
          <span className="flex items-center gap-1.5"><Flag className="size-4 shrink-0" />{item.type ?? 'N/A'}</span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Minority</dt><dd className="font-medium text-foreground">{item.minority || '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Level</dt><dd className="font-medium text-foreground">{item.level || '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Women</dt><dd className="font-medium text-foreground">{item.women || '—'}</dd></div>
        </dl>
      </CardContent>
    </Card>
  );
}
