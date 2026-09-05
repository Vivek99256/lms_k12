'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Compass, Filter, LoaderCircle, Search, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { EduSideMenu } from './_components/EduSideMenu';
import { ClusterGrid } from './_components/ClusterGrid';
import { ResultsList } from './_components/ResultsList';
import { loadClusters, loadFilteredResults, loadSideMenu, searchCareers } from './_lib/api';
import type { ClusterItem, ResultItem, SelectedFilters, SideMenuSection } from './_lib/types';

interface DrillStep {
  index: number;
  item: ClusterItem;
}

function hasSelectedFilters(filters: SelectedFilters) {
  return Object.values(filters).some((ids) => ids.length > 0);
}

export default function CareerExplorerHub() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [sideMenu, setSideMenu] = useState<SideMenuSection[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({});
  const [filterResults, setFilterResults] = useState<ResultItem[] | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<ResultItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clusterData, sideMenuData] = await Promise.all([loadClusters(), loadSideMenu()]);
      setClusters(clusterData);
      setSideMenu(sideMenuData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load career explorer.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Restore the drill-down path from the URL (?path=0.2) once clusters have loaded.
  useEffect(() => {
    if (!clusters.length) return;
    const raw = searchParams.get('path');
    if (!raw) return;
    const indices = raw.split('.').map((value) => Number.parseInt(value, 10)).filter((n) => !Number.isNaN(n));
    const path: DrillStep[] = [];
    let level = clusters;
    for (const index of indices) {
      const item = level[index];
      if (!item) break;
      path.push({ index, item });
      level = item.children ?? [];
    }
    if (path.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrillPath(path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters]);

  const syncPath = (path: DrillStep[]) => {
    setDrillPath(path);
    const params = new URLSearchParams(searchParams.toString());
    if (path.length) params.set('path', path.map((step) => step.index).join('.'));
    else params.delete('path');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const currentLevelItems = useMemo(() => {
    if (!drillPath.length) return clusters;
    return drillPath[drillPath.length - 1].item.children ?? [];
  }, [clusters, drillPath]);

  const handleSelectCluster = (item: ClusterItem, index: number) => {
    if (drillPath.length >= 2 || !item.children?.length) return;
    syncPath([...drillPath, { index, item }]);
  };

  const handleFiltersChange = useCallback(async (filters: SelectedFilters) => {
    setSelectedFilters(filters);
    setSearchResults(null);
    setSearchInput('');
    if (!hasSelectedFilters(filters)) {
      setFilterResults(null);
      return;
    }
    setFilterLoading(true);
    try {
      setFilterResults(await loadFilteredResults(filters));
    } catch {
      setFilterResults([]);
    } finally {
      setFilterLoading(false);
    }
  }, []);

  const handleSearchSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchInput.trim()) return;
    setSelectedFilters({});
    setFilterResults(null);
    setSearchLoading(true);
    try {
      setSearchResults(await searchCareers(searchInput));
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const resultsMode = hasSelectedFilters(selectedFilters) || searchResults !== null;
  const activeResults = searchResults ?? filterResults ?? [];
  const activeResultsLoading = searchLoading || filterLoading;
  const activeFilterCount = Object.values(selectedFilters).reduce((total, ids) => total + ids.length, 0);

  const bannerTitle = drillPath.length
    ? drillPath[drillPath.length - 1].item.career_cluster ?? drillPath[drillPath.length - 1].item.career_pathway ?? ''
    : '';

  // The cluster tree is exactly 3 levels deep (cluster -> pathway -> occupation).
  // The occupation/leaf level has no image/name field (only title/description),
  // so it renders as a results list instead of an image-card grid.
  const isLeafLevel = drillPath.length === 2;

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading career explorer…
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Unable to load career explorer" description={error} retry={refresh} />;
  }

  const filterPanel = <EduSideMenu sideMenu={sideMenu} selectedFilters={selectedFilters} onChange={handleFiltersChange} />;

  return (
    <div className="space-y-5 p-1 md:p-2">
      <header className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-[#0D6EFD]">
              <span className="flex size-6 items-center justify-center rounded-md bg-[#0D6EFD]/10">
                <Compass className="size-3.5" />
              </span>
              Career explorer
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Find occupation</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Browse career clusters and pathways, or search directly by keyword, career name, or major.
            </p>
          </div>
          <Badge variant="outline" className="border-[#0D6EFD]/20 bg-[#0D6EFD]/10 text-[#0D6EFD]">
            <Search />
            Discovery
          </Badge>
        </div>
      </header>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Search for careers</CardTitle>
          <CardDescription>Enter a keyword, career name, or major to search directly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="flex w-full flex-col gap-2 sm:flex-row">
            <SearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter keyword, career name or major"
              icon={<Search className="size-4" />}
              size="lg"
              className="h-11"
            />
            <Button type="submit" disabled={searchLoading} className="bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90">
              {searchLoading ? <LoaderCircle className="animate-spin" /> : <Search />}
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="hidden self-start lg:block lg:sticky lg:top-4">
          <CardContent>{filterPanel}</CardContent>
        </Card>

        <div className="lg:hidden">
          <Button
            variant="outline"
            onClick={() => setMobileFiltersOpen(true)}
            className="border-[#0D6EFD]/20 text-[#0D6EFD] hover:bg-[#0D6EFD]/10 hover:text-[#0D6EFD]"
          >
            <SlidersHorizontal />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="outline" className="border-[#0D6EFD]/20 bg-[#0D6EFD]/10 text-[#0D6EFD]">{activeFilterCount}</Badge>
            )}
          </Button>
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetContent side="left" className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Filter className="size-4 text-[#0D6EFD]" />
                  Filters
                </SheetTitle>
              </SheetHeader>
              {filterPanel}
            </SheetContent>
          </Sheet>
        </div>

        <Card>
          <CardHeader>
            {drillPath.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <button type="button" className="hover:text-foreground hover:underline" onClick={() => syncPath([])}>
                  All clusters
                </button>
                {drillPath.map((step, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span>/</span>
                    <button
                      type="button"
                      className="hover:text-foreground hover:underline"
                      onClick={() => syncPath(drillPath.slice(0, i + 1))}
                    >
                      {step.item.career_cluster ?? step.item.career_pathway ?? `Level ${i + 1}`}
                    </button>
                  </span>
                ))}
              </div>
            )}
            <CardTitle>{bannerTitle || 'Explore careers and see what catches your eye'}</CardTitle>
            <CardDescription>
              {resultsMode
                ? 'Occupations matching your search or selected filters.'
                : 'Browse career clusters, drill into pathways, and discover occupations.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!resultsMode && !isLeafLevel && (
              <ClusterGrid
                items={currentLevelItems}
                onSelect={handleSelectCluster}
                onAdvice={(item) => router.push(`/career-explorer/expert-advice?title=${encodeURIComponent(item.career_cluster ?? item.career_pathway ?? "")}`)}
                onExplore={(item) => router.push(`/career-explorer/explore-sectors?title=${encodeURIComponent(item.career_cluster ?? item.career_pathway ?? "")}`)}
              />
            )}
            {!resultsMode && isLeafLevel && <ResultsList items={currentLevelItems} />}

            {resultsMode && activeResultsLoading && (
              <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Loading results…
              </div>
            )}

            {resultsMode && !activeResultsLoading && <ResultsList items={activeResults} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
