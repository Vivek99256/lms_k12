'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Banner, FormField, LoadingBlock, inputClass } from '@/app/alumni/_components/alumni-ui';
import { PortalApiError, portalApi } from '../_lib/portal-api';
import { PASSWORD_HINT, PortalCard, PortalLink, firstError } from '../_components/portal-ui';

export default function PortalInvitePage() {
  return <Suspense fallback={null}><Invite /></Suspense>;
}

function Invite() {
  const token = useSearchParams().get('token') ?? '';
  const [info, setInfo] = useState<{ institute_code: string | null; email_hint: string } | null | undefined>(undefined);   // undefined = loading, null = invalid
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    portalApi.inviteCheck(token).then((r) => { if (!cancelled) setInfo(r.data); }).catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    if (password !== confirm) { setErrors({ confirm: ['The two passwords are not the same.'] }); return; }
    setBusy(true);
    try { setDone((await portalApi.inviteAccept(token, password)).message); }
    catch (reason) {
      if (reason instanceof PortalApiError) { setErrors(reason.fieldErrors); setError(firstError(reason.fieldErrors, 'token') ?? reason.message); } else setError("Couldn't save your password. Please try again.");
    } finally { setBusy(false); }
  }

  const invalid = !token || info === null;
  if (invalid) return <PortalCard title="Invitation" footer={<PortalLink href="/alumni-portal/login">Sign in</PortalLink>}><Banner>This invitation is invalid or has expired. Ask the institute to send you a new one.</Banner></PortalCard>;
  if (info === undefined) return <PortalCard title="Invitation"><LoadingBlock label="Checking your invitation…" /></PortalCard>;
  if (done) return <PortalCard title="Almost there" footer={<PortalLink href={`/alumni-portal/login${info.institute_code ? `?i=${encodeURIComponent(info.institute_code)}` : ''}`}>Go to sign in</PortalLink>}><Banner tone="success">{done}</Banner></PortalCard>;

  return (
    <PortalCard title="Welcome to the alumni portal" intro={`Choose a password for ${info.email_hint}.`}>
      {error ? <Banner>{error}</Banner> : null}
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormField label="Password" hint={PASSWORD_HINT} error={firstError(errors, 'password')}><input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></FormField>
        <FormField label="Type it again" error={firstError(errors, 'confirm')}><input className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></FormField>
        <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Saving…' : 'Set my password'}</Button>
      </form>
    </PortalCard>
  );
}
