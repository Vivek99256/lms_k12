'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { CareerExplorerPageHeader } from '../_components/CareerExplorerPageHeader';
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
    <div className="space-y-5 p-1 md:p-2">
      <CareerExplorerPageHeader
        icon={BookOpen}
        title="Course profile"
        description="Explore courses that suit your future — search by name below."
        badgeIcon={BookOpen}
        badgeLabel="Programmes"
      />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Courses</CardTitle>
            <CardDescription>{loading ? 'Loading…' : `${filtered.length} course${filtered.length === 1 ? '' : 's'} found.`}</CardDescription>
          </div>
          <div className="w-full sm:w-72 lg:w-[420px]">
            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by course name"
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
            <ErrorState title="Unable to load courses" description={error} retry={() => void refresh()} />
          )}

          {!loading && !error && filtered.length === 0 && (
            <EmptyState icon={<BookOpen className="size-8" />} title="No courses found" description="Try a different search term." />
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filtered.map((item, index) => <CourseCard key={`${item.course_name}-${index}`} item={item} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CourseCard({ item }: { item: CourseItem }) {
  return (
    <Card size="sm" className="transition-shadow hover:shadow-md">
      <CardContent>
        <CardTitle className="text-[#0D6EFD]">{item.course_name}</CardTitle>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.course_level && <Badge variant="outline">{item.course_level}</Badge>}
          {item.programme && <Badge variant="outline">{item.programme}</Badge>}
          {item.course_type && <Badge variant="outline">{item.course_type}</Badge>}
          {item.course_fees && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">₹{item.course_fees}</Badge>
          )}
        </div>
        {item.description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>}
      </CardContent>
    </Card>
  );
}
