'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Banner, FormField, inputClass } from '@/app/alumni/_components/alumni-ui';
import { portalApi, portalSession } from '../_lib/portal-api';
import { PortalCard, PortalLink } from '../_components/portal-ui';

export default function PortalForgotPasswordPage() {
  return <Suspense fallback={null}><ForgotForm /></Suspense>;
}

function ForgotForm() {
  const params = useSearchParams();
  const [code, setCode] = useState(() => params.get('i') ?? portalSession.institute());
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!code.trim() || !email.trim()) { setError('Enter the institute code and your email.'); return; }
    setBusy(true);
    try { setMessage((await portalApi.forgotPassword(code.trim(), email.trim())).message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't send the link. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <PortalCard title="Forgot your password?" intro="We will email you a link to choose a new one." footer={<PortalLink href="/alumni-portal/login">Back to sign in</PortalLink>}>
      {error ? <Banner>{error}</Banner> : null}
      {message ? <Banner tone="success">{message}</Banner> : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField label="Institute code"><input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} /></FormField>
          <FormField label="Email"><input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></FormField>
          <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Sending…' : 'Send the link'}</Button>
        </form>
      )}
    </PortalCard>
  );
}
