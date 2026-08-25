'use client';

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildSessionContext, createAuthHeaders, appendCommonParams } from '@/lib/erp-client';

const KINDS = [
  { value: 'position', label: 'Position' },
  { value: 'margin', label: 'Margin' },
  { value: 'pnl', label: 'P&L' },
];

export function BazarUploadPage() {
  const [kind, setKind] = useState('position');
  const [uploadDate, setUploadDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit() {
    if (!uploadDate || !file) { setError('Upload date and a file are required.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const session = buildSessionContext();
      if (!session.token || !session.subInstituteId || !session.syear || !session.userId) throw new Error('Your login session is incomplete.');
      const params = new URLSearchParams();
      appendCommonParams(params, session);
      params.set('user_id', session.userId);
      const form = new FormData();
      form.set('kind', kind);
      form.set('upload_date', uploadDate);
      form.set('attachment', file);
      const response = await fetch(`${session.baseUrl}/api/migration-modules/bazar-upload?${params}`, {
        method: 'POST', body: form, headers: createAuthHeaders(session),
      });
      const payload = await response.json();
      if (!response.ok || payload.status_code !== 1) throw new Error(payload.message || 'Upload failed.');
      setNotice(payload.message || 'Upload completed.');
      setFile(null); setUploadDate('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); } finally { setBusy(false); }
  }

  return <div className="space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Bazar Bulk Upload</h1><p className="text-sm text-muted-foreground">Upload position, margin, or P&amp;L data from an Excel file.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p className="text-sm text-emerald-600">{notice}</p>}
    <Card><CardHeader><CardTitle>Upload</CardTitle></CardHeader><CardContent>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><Label htmlFor="kind">Type</Label><select id="kind" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
        <div><Label htmlFor="upload_date">Upload Date</Label><Input id="upload_date" type="date" className="mt-1" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} /></div>
        <div><Label htmlFor="attachment">File (.xls, .xlsx)</Label><Input id="attachment" type="file" accept=".xls,.xlsx" className="mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      </div>
      <div className="mt-5"><Button onClick={() => void submit()} disabled={busy}><UploadCloud className="size-4" /> {busy ? 'Uploading…' : 'Upload'}</Button></div>
    </CardContent></Card>
  </div>;
}
