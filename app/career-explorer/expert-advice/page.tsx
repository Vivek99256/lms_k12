'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, MapPin, Phone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { loadExpertAdvice } from '../_lib/api';

type Expert = { name?: string; description?: string; image?: string; education?: string; city?: string; state?: string; contact_no?: string };

export default function ExpertAdvicePage() {
  const title = useSearchParams().get('title') ?? '';
  const [experts, setExperts] = useState<Expert[]>([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState('');
  useEffect(() => { setLoading(true); loadExpertAdvice(title).then((data) => setExperts((data.data ?? []) as Expert[])).catch(() => setExperts([])).finally(() => setLoading(false)); }, [title]);
  const visible = useMemo(() => experts.filter((expert) => (expert.name ?? '').toLowerCase().includes(search.toLowerCase())), [experts, search]);
  return <div className="container mx-auto px-4"><section className="mb-10 overflow-hidden rounded-[26px] bg-[#0D6EFD] pt-5 md:rounded-[48px]"><div className="rounded-t-[26px] bg-card p-5 md:rounded-t-[48px] md:p-10"><h1 className="text-3xl font-semibold text-[#0D6EFD]">Advise from Experts</h1><p className="mt-2 text-muted-foreground">Experts for {title || 'your selected sector'}</p><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search experts" className="mt-6 h-11 w-full rounded-lg border px-4" />{loading ? <div className="flex min-h-48 items-center justify-center gap-2"><LoaderCircle className="animate-spin" />Loading experts...</div> : <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">{visible.map((expert, index) => <article key={`${expert.name}-${index}`} className="flex gap-4 rounded-lg border p-4 shadow-sm"><img src={expert.image} alt={expert.name ?? 'Expert'} className="size-20 rounded-full object-cover" /><div className="min-w-0"><h2 className="font-semibold">{expert.name}</h2><p className="mt-1 text-sm text-muted-foreground">{expert.description}</p><p className="mt-2 text-sm">{expert.education}</p><p className="mt-1 flex items-center gap-1 text-sm"><MapPin className="size-4" />{[expert.city, expert.state].filter(Boolean).join(', ')}</p>{expert.contact_no && <a className="mt-3 inline-flex items-center gap-1 rounded bg-[#0D6EFD] px-3 py-2 text-sm text-white" href={`tel:${expert.contact_no}`}><Phone className="size-4" />Book a free counselling</a>}</div></article>)}{!visible.length && <p className="py-10 text-center text-muted-foreground xl:col-span-2">No experts found for this sector.</p>}</div>}</div></section></div>;
}