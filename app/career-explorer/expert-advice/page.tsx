'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  GraduationCap, MapPin, MessageCircleQuestion, Phone, Search, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SearchInput } from '@/components/ui/search-input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { CareerExplorerPageHeader } from '../_components/CareerExplorerPageHeader';
import { ProfileImage } from '../_components/ProfileImage';
import { loadExpertAdvice } from '../_lib/api';

type Expert = {
  name?: string;
  description?: string;
  image?: string;
  education?: string;
  city?: string;
  state?: string;
  contact_no?: string;
  benefits?: string;
  university_shortlist?: string;
};

type ExpertDialog = { title: string; content: string } | null;

const ACCENT = {
  text: 'text-[#0D6EFD]',
  ring: 'ring-[#0D6EFD]/20',
  badge: 'border-[#0D6EFD]/20 bg-[#0D6EFD]/10 text-[#0D6EFD]',
  avatarBg: 'bg-[#0D6EFD]/10',
  solid: 'bg-[#0D6EFD]',
};

export default function ExpertAdvicePage() {
  const title = useSearchParams().get('title') ?? '';
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<ExpertDialog>(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadExpertAdvice(title);
      setExperts((data.data ?? []) as Expert[]);
    } catch (err) {
      setExperts([]);
      setError(err instanceof Error ? err.message : 'Unable to load experts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const visible = useMemo(
    () => experts.filter((expert) => (expert.name ?? '').toLowerCase().includes(search.toLowerCase())),
    [experts, search]
  );

  return (
    <div className="space-y-5 p-1 md:p-2">
      <CareerExplorerPageHeader
        icon={Users}
        title="Advice from experts"
        description={`Experts for ${title || 'your selected sector'}.`}
        badgeIcon={Users}
        badgeLabel="Expert guidance"
      />

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Experts</CardTitle>
            <CardDescription>{loading ? 'Loading…' : `${visible.length} expert${visible.length === 1 ? '' : 's'} found.`}</CardDescription>
          </div>
          <div className="w-full sm:w-72 lg:w-[420px]">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search experts"
              icon={<Search className="size-4" />}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {[...Array(4)].map((_, index) => <Skeleton key={index} className="h-28 w-full rounded-xl" />)}
            </div>
          )}

          {!loading && error && (
            <ErrorState title="Unable to load experts" description={error} retry={() => void refresh()} />
          )}

          {!loading && !error && visible.length === 0 && (
            <EmptyState icon={<Users className="size-8" />} title="No experts found" description="Try a different sector or search term." />
          )}

          {!loading && !error && visible.length > 0 && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {visible.map((expert, index) => (
                <Card key={`${expert.name}-${index}`} size="sm" className="transition-shadow hover:shadow-md">
                  <CardContent>
                    <div className="flex gap-4">
                      <ProfileImage
                        className={`size-16 shrink-0 rounded-full object-cover ring-2 ${ACCENT.ring}`}
                        fallbackClassName={`flex size-16 shrink-0 items-center justify-center rounded-full ring-2 ${ACCENT.ring} ${ACCENT.avatarBg}`}
                        src={expert.image}
                        alt={expert.name ?? 'Expert'}
                      />
                      <div className="min-w-0 flex-1">
                        <CardTitle className={ACCENT.text}>{expert.name}</CardTitle>
                        {expert.description && <p className="mt-1 text-sm text-muted-foreground">{expert.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {expert.education && <Badge variant="outline" className={ACCENT.badge}>{expert.education}</Badge>}
                          {(expert.city || expert.state) && (
                            <Badge variant="outline">
                              <MapPin className="size-3" />
                              {[expert.city, expert.state].filter(Boolean).join(', ')}
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className={`mt-3 text-white hover:opacity-90 ${ACCENT.solid}`}
                          onClick={() => setDialog({
                            title: `Free counselling with ${expert.name ?? 'this expert'}`,
                            content: expert.benefits || '<p>No counselling details are available for this expert yet.</p>',
                          })}
                        >
                          <Phone />
                          Book a free counselling
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className={`rounded-md py-1.5 text-center text-xs font-semibold text-white ${ACCENT.solid}`}>
                      Attend this session and get these benefits
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {expert.contact_no ? (
                        <a href={`tel:${expert.contact_no}`} className="flex flex-col items-center gap-2 text-center">
                          <span className={`flex size-11 items-center justify-center rounded-full text-white ${ACCENT.solid}`}>
                            <MessageCircleQuestion className="size-5" />
                          </span>
                          <p className="text-xs font-medium text-foreground">Live Q&amp;A with an expert counsellor</p>
                        </a>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center opacity-50">
                          <span className={`flex size-11 items-center justify-center rounded-full text-white ${ACCENT.solid}`}>
                            <MessageCircleQuestion className="size-5" />
                          </span>
                          <p className="text-xs font-medium text-foreground">Live Q&amp;A with an expert counsellor</p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setDialog({
                          title: 'University shortlist',
                          content: expert.university_shortlist || '<p>No university shortlist is available for this expert yet.</p>',
                        })}
                        className="flex flex-col items-center gap-2 text-center"
                      >
                        <span className={`flex size-11 items-center justify-center rounded-full text-white ${ACCENT.solid}`}>
                          <GraduationCap className="size-5" />
                        </span>
                        <p className="text-xs font-medium text-foreground">Get university shortlist</p>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.title}</DialogTitle>
          </DialogHeader>
          <div
            className="prose max-w-none text-sm leading-6 text-foreground"
            dangerouslySetInnerHTML={{ __html: dialog?.content ?? '' }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
