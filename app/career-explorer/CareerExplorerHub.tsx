'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoaderCircle, Menu, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CareerExplorerTabBar } from './_components/CareerExplorerTabBar';
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
  const [mobileMenu, setMobileMenu] = useState(false);

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
        Loading career explorerâ€¦
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
        <p className="max-w-lg text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      <CareerExplorerTabBar />
      <div className="bg-[#0D6EFD] w-[100%] mt-[42px] rounded-[26px] md:rounded-[48px]">
        <div className="flex gap-[20px] items-center px-10 py-[18px] pr-[20px]">
          <button type="button" onClick={() => setMobileMenu(true)} className="block lg:hidden text-white">
            <Menu className="size-5" />
          </button>
          <h3 className="xl:text-[18px] font-semibold text-white">EDUCATION LEVEL</h3>
        </div>

        <div className="flex gap-[5px] w-[100%] px-3 lg:pl-[20px]">
          <div className="hidden lg:block w-[30%] xl:w-[30%]">
            <EduSideMenu sideMenu={sideMenu} selectedFilters={selectedFilters} onChange={handleFiltersChange} />
          </div>

          {mobileMenu && (
            <div className="fixed top-0 z-10 block w-full h-screen overflow-y-auto left-0 lg:hidden bg-[#0D6EFD]">
              <div className="flex justify-end p-3">
                <button type="button" onClick={() => setMobileMenu(false)} className="text-white">
                  <X className="size-5" />
                </button>
              </div>
              <EduSideMenu sideMenu={sideMenu} selectedFilters={selectedFilters} onChange={handleFiltersChange} />
            </div>
          )}

          <div className="w-full lg:w-[70%] xl:w-[75%] bg-card rounded-[10px] md:rounded-[48px] mb-10 p-[10px] md:p-[35px]">
            {drillPath.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pb-4 text-sm text-muted-foreground">
                <button type="button" className="underline" onClick={() => syncPath([])}>
                  All clusters
                </button>
                {drillPath.map((step, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <span>/</span>
                    <button type="button" className="underline" onClick={() => syncPath(drillPath.slice(0, i + 1))}>
                      {step.item.career_cluster ?? step.item.career_pathway ?? `Level ${i + 1}`}
                    </button>
                  </span>
                ))}
              </div>
            )}

            <h3 className="text-[20px] xl:text-[28px] font-semibold text-card-foreground">
              Explore Careers and See What Catches Your Eye
            </h3>
            <p className="xl:text-[18px] font-medium text-muted-foreground py-[6px] xl:py-[12px]">
              Search careers by keyword, category, education level, and / or the results of questionnaires
            </p>

            <div className="bg-[#0D6EFD] mt-5 xl:mt-0 py-[35px] px-[15px] rounded-[20px]">
              <h2 className="text-[18px] xl:text-[30px] text-white">Search For Careers</h2>
              <form onSubmit={handleSearchSubmit} className="flex w-full gap-1 mt-3">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-[45px] px-[15px] rounded-[10px] border border-input bg-background text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter keyword, career name or major"
                  type="text"
                />
                <button type="submit" className="bg-secondary text-secondary-foreground text-[16px] w-[121px] rounded-[10px]">
                  Submit
                </button>
              </form>
            </div>

            <div className="w-[100%] mt-10">
              {bannerTitle && !resultsMode && (
                <div className="relative mt-[20px]">
                  <div className="rounded-[10px] w-[70%] mx-auto bg-foreground/80">
                    <div className="text-center py-[8px] text-[22px] 2xl:text-[30px]">
                      <h2 className="text-background">{bannerTitle}</h2>
                    </div>
                  </div>
                </div>
              )}

              {!resultsMode && !isLeafLevel && (
                <ClusterGrid items={currentLevelItems} onSelect={handleSelectCluster} onAdvice={(item) => router.push(`/career-explorer/expert-advice?title=${encodeURIComponent(item.career_cluster ?? item.career_pathway ?? "")}`)} onExplore={(item) => router.push(`/career-explorer/explore-sectors?title=${encodeURIComponent(item.career_cluster ?? item.career_pathway ?? "")}`)} />
              )}
              {!resultsMode && isLeafLevel && <ResultsList items={currentLevelItems} />}

              {resultsMode && activeResultsLoading && (
                <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading resultsâ€¦
                </div>
              )}

              {resultsMode && !activeResultsLoading && <ResultsList items={activeResults} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
