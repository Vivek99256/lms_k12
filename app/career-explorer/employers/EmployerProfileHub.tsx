'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CareerExplorerTabBar } from '../_components/CareerExplorerTabBar';
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
    <div className="container mx-auto px-4">
      <CareerExplorerTabBar />

      <section className="mb-10 overflow-hidden rounded-[10px] bg-[#0D6EFD] pt-4 md:rounded-[48px] md:pt-8">
        <div className="rounded-t-[26px] bg-card p-[10px] md:rounded-t-[48px] md:p-[35px]">
        <h1 className="py-3 text-[26px] font-semibold text-[#0D6EFD] underline md:text-4xl">
          EMPLOYERS &amp; SECTOR PROFILE
        </h1>
        <p className="xl:text-[18px] font-medium text-muted-foreground py-[6px] xl:py-[12px]">
          Search employers by field
        </p>

        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full h-[45px] px-[15px] mt-3 rounded-[10px] border border-input bg-background text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Search by employee field"
          type="text"
        />

        {loading && (
          <div className="flex min-h-32 items-center justify-center gap-2 mt-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading employers...</div>
        )}

        {!loading && error && (
          <div className="flex min-h-32 flex-col items-center justify-center gap-3 mt-10 text-center">
            <p className="max-w-lg text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="mt-10 text-sm text-muted-foreground">No employee found.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-10">
            {filtered.map((item, index) => (
              <div key={`${item.profile}-${index}`} className="relative rounded-[14px] border border-border p-4 bg-background">
                <ProfileImage
                  className="absolute top-4 right-4 h-16 w-20 object-contain"
                  fallbackClassName="absolute top-4 right-4 flex h-16 w-20 items-center justify-center rounded-md bg-muted"
                  src={item.company_logo}
                  alt={item.company_name ?? 'Company'}
                />
                <h2 className="text-lg font-semibold text-[#0D6EFD] pr-24">{item.profile}</h2>
                <p className="text-sm text-muted-foreground">{item.category}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
                  <span>Company: {item.company_name}</span>
                  <span>Email: {item.email}</span>
                  <span>Phone: {item.phone}</span>
                  <span>Position: {item.type}</span>
                  <span>Start Date: {item.created_at}</span>
                  <span>Duration: {item.duration}</span>
                  <span>Stipend: {item.stipend}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
