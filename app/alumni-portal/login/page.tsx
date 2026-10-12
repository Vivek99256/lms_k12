'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Banner, FormField, inputClass } from '@/app/alumni/_components/alumni-ui';
import { PortalApiError, portalApi, portalSession } from '../_lib/portal-api';
import { PortalCard, PortalLink } from '../_components/portal-ui';

export default function PortalLoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => params.get('i') ?? portalSession.institute());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setNotice(''); setNeedsConfirm(false);
    if (!code.trim() || !email.trim() || !password) { setError('Enter the institute code, your email and your password.'); return; }
    setBusy(true);
    try {
      await portalApi.login({ institute_code: code.trim(), email: email.trim(), password });
      router.push('/alumni-portal');
    } catch (reason) {
      if (reason instanceof PortalApiError) { setError(reason.message); setNeedsConfirm(reason.status === 403); }
      else setError("Couldn't sign you in. Please try again.");
    } finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true);
    try { setNotice((await portalApi.resendVerification(code.trim(), email.trim())).message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't send a new link."); }
    finally { setBusy(false); }
  }

  return (
    <PortalCard title="Sign in" intro="For alumni of your institute." footer={<>New here? <PortalLink href="/alumni-portal/register">Create an account</PortalLink></>}>
      {error ? <Banner>{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {needsConfirm ? <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={resend}>Send me a new confirmation link</Button> : null}
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormField label="Institute code" hint="The short code your institute gave you"><input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="organization" /></FormField>
        <FormField label="Email"><input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></FormField>
        <FormField label="Password"><input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></FormField>
        <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="text-sm"><PortalLink href="/alumni-portal/forgot-password">Forgot your password?</PortalLink></p>
    </PortalCard>
  );
}
