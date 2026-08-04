'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

const TITLES: Record<string, string> = {
  'learning-outcomes': 'Learning Outcome Master', 'indicator-mappings': 'Learning Outcome Indicator Mapping',
  'students-marks': 'Students Marks Report', 'bazar-upload': 'Bazar Bulk Upload', 'bazar-reports': 'Bazar Bulk Upload Report',
  'subject-electives': 'Subject – Standard Elective Mapping', biomatrix: 'Biometric Integration (Biomatrix)',
  'dynamic-reports': 'Dynamic Report Builder', 'broken-links': 'Broken-link Finder', nomenclature: 'Nomenclature',
};

export function MigrationModulePage({ module }: { module: string }) {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const session = buildSessionContext();
      if (!session.token || !session.subInstituteId || !session.syear || !session.userId) throw new Error('Your login session is incomplete.');
      const query = new URLSearchParams({ type: 'API', sub_institute_id: session.subInstituteId, syear: session.syear, user_id: session.userId });
      const response = await fetch(`${session.baseUrl}/api/migration-modules/${module}?${query}`, { cache: 'no-store', headers: createAuthHeaders(session) });
      const payload = await response.json();
      if (!response.ok || payload.status_code !== 1) throw new Error(payload.message || 'Unable to load this module.');
      setRecords(Array.isArray(payload.data?.records) ? payload.data.records : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load this module.'); } finally { setLoading(false); }
  }, [module]);
  useEffect(() => { void load(); }, [load]);
  const columns = [...new Set(records.flatMap((row) => Object.keys(row)))].slice(0, 10);
  return <div className="space-y-6 p-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-semibold">{TITLES[module] || module}</h1><p className="text-sm text-muted-foreground">Migrated API-backed ERP module</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button></div><Card><CardHeader><CardTitle>Records</CardTitle></CardHeader><CardContent>{error ? <p className="text-sm text-destructive">{error}</p> : loading ? <p className="text-sm text-muted-foreground">Loading…</p> : records.length === 0 ? <p className="text-sm text-muted-foreground">No records found.</p> : <div className="overflow-auto"><table className="w-full text-sm"><thead><tr>{columns.map(c=><th className="border-b p-2 text-left" key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{records.map((r,i)=><tr key={String(r.id ?? r.ID ?? i)}>{columns.map(c=><td className="border-b p-2" key={c}>{typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c] ?? '—')}</td>)}</tr>)}</tbody></table></div>}</CardContent></Card></div>;
}
