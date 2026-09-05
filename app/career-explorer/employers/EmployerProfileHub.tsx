'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { CareerExplorerPageHeader } from '../_components/CareerExplorerPageHeader';
import { ProfileImage } from '../_components/ProfileImage';
import { loadEmployers } from '../_lib/api';
import type { EmployerItem } from '../_lib/types';

export default function EmployerProfileHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employers, setEmployers] = useState<EmployerItem[]>([]);
  const [searchInput, setSearchInput] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setEmployers(await loadEmployers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load employers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  const filtered = useMemo(
    () => employers.filter((item) => (item.profile ?? '').toLowerCase().includes(searchInput.toLowerCase())),
    [employers, searchInput]
  );

  return (
    <div className="space-y-5 p-1 md:p-2">
      <CareerExplorerPageHeader
        icon={Building2}
        title="Employer profile"
        description="Explore employers and sectors that suit your future — search by field below."
        badgeIcon={Building2}
        badgeLabel="Employers"
      />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Employers</CardTitle>
            <CardDescription>{loading ? 'Loading…' : `${filtered.length} employer${filtered.length === 1 ? '' : 's'} found.`}</CardDescription>
          </div>
          <div className="w-full sm:w-72 lg:w-[420px]">
            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by employer field"
              icon={<Search className="size-4" />}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[...Array(4)].map((_, index) => <Skeleton key={index} className="h-36 w-full rounded-xl" />)}
            </div>
          )}

          {!loading && error && (
            <ErrorState title="Unable to load employers" description={error} retry={() => void refresh()} />
          )}

          {!loading && !error && filtered.length === 0 && (
            <EmptyState icon={<Building2 className="size-8" />} title="No employers found" description="Try a different search term." />
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filtered.map((item, index) => <EmployerCard key={`${item.profile}-${index}`} item={item} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmployerCard({ item }: { item: EmployerItem }) {
  return (
    <Card size="sm" className="transition-shadow hover:shadow-md">
      <CardContent className="flex gap-3">
        <ProfileImage
          className="size-16 shrink-0 rounded-md object-contain"
          fallbackClassName="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted"
          src={item.company_logo}
          alt={item.company_name ?? 'Company'}
        />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-[#0D6EFD]">{item.profile}</CardTitle>
          {item.category && <p className="text-sm text-muted-foreground">{item.category}</p>}
          {item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.company_name && <Badge variant="outline">{item.company_name}</Badge>}
            {item.type && <Badge variant="outline">{item.type}</Badge>}
            {item.duration && <Badge variant="outline">{item.duration}</Badge>}
            {item.stipend && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Stipend: {item.stipend}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
