'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { CareerExplorerTabBar } from '../_components/CareerExplorerTabBar';
import { loadExploreSector, type ExploreSectorResponse } from '../_lib/api';

export default function ExploreSectorsPage() {
  const title = useSearchParams().get('title') ?? ''; const [data, setData] = useState<ExploreSectorResponse>({}); const [active, setActive] = useState('about_us'); const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); loadExploreSector(title).then(setData).catch(() => setData({ title })).finally(() => setLoading(false)); }, [title]);
  const sections = data.data ?? []; const current = sections.find((section) => section.key === active) ?? sections[0];
  return <div className="container mx-auto px-4"><CareerExplorerTabBar /><section className="mb-10 overflow-hidden rounded-[26px] bg-[#0D6EFD] pt-5 md:rounded-[48px]"><div className="rounded-t-[26px] bg-card p-5 md:rounded-t-[48px] md:p-10"><h1 className="text-center text-3xl font-semibold text-[#0D6EFD]">Explore More On Sectors</h1>{loading ? <div className="flex min-h-64 items-center justify-center gap-2"><LoaderCircle className="animate-spin" />Loading sector...</div> : <><div className="relative mt-6 overflow-hidden rounded-lg"><img src={data.image} alt={data.title ?? title} className="h-[300px] w-full object-cover" /><h2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 py-2 text-xl font-semibold">{data.title ?? title}</h2></div><div className="mt-8 flex flex-wrap justify-center gap-5 font-semibold">{sections.map((section) => <button key={section.key} type="button" onClick={() => setActive(section.key ?? '')} className={active === section.key ? 'border-b-4 border-[#0D6EFD] pb-2 text-[#0D6EFD]' : 'pb-2'}>{section.value ?? section.key}</button>)}</div><div className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: current?.html ?? '<p>No content available for this sector.</p>' }} /></>}</div></section></div>;
}