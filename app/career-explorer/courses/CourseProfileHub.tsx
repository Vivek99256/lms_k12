'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadCourses } from '../_lib/api';
import type { CourseItem } from '../_lib/types';

export default function CourseProfileHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [searchInput, setSearchInput] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setCourses(await loadCourses());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  const filtered = useMemo(
    () => courses.filter((item) => (item.course_name ?? '').toLowerCase().includes(searchInput.toLowerCase())),
    [courses, searchInput]
  );

  return (
    <div className="container mx-auto px-4">
      <section className="mb-10 overflow-hidden rounded-[10px] bg-[#0D6EFD] pt-4 md:rounded-[48px] md:pt-8">
        <div className="rounded-t-[26px] bg-card p-[10px] md:rounded-t-[48px] md:p-[35px]">
        <h1 className="py-3 text-[26px] font-semibold text-[#0D6EFD] underline md:text-4xl">
          Explore Your Future Course&apos;s
        </h1>
        <p className="xl:text-[18px] font-medium text-muted-foreground py-[6px] xl:py-[12px]">
          Search courses by name
        </p>

        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full h-[45px] px-[15px] mt-3 rounded-[10px] border border-input bg-background text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Search by course Name"
          type="text"
        />

        {loading && (
          <div className="flex min-h-32 items-center justify-center gap-2 mt-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading coursesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦
          </div>
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
          <div className="mt-10 text-sm text-muted-foreground">No course found.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-10">
            {filtered.map((item, index) => (
              <div key={`${item.course_name}-${index}`} className="rounded-[14px] border border-border p-4 bg-background">
                <h2 className="text-lg font-semibold text-[#0D6EFD]">{item.course_name}</h2>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-border p-2 text-muted-foreground">Level: {item.course_level}</div>
                  <div className="rounded-md border border-border p-2 text-muted-foreground">Programme: {item.programme}</div>
                  <div className="rounded-md border border-border p-2 text-muted-foreground">Type: {item.course_type}</div>
                  <div className="rounded-md border border-border p-2 text-muted-foreground">Fees: {item.course_fees}</div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
