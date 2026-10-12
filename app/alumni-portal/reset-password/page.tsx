'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Banner, FormField, inputClass } from '@/app/alumni/_components/alumni-ui';
import { PortalApiError, portalApi } from '../_lib/portal-api';
import { PASSWORD_HINT, PortalCard, PortalLink, firstError } from '../_components/portal-ui';

export default function PortalResetPasswordPage() {
  return <Suspense fallback={null}><ResetForm /></Suspense>;
}

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    if (password !== confirm) { setErrors({ confirm: ['The two passwords are not the same.'] }); return; }
    setBusy(true);
    try { await portalApi.resetPassword(token, password); setDone(true); }
    catch (reason) {
      if (reason instanceof PortalApiError) { setErrors(reason.fieldErrors); setError(firstError(reason.fieldErrors, 'token') ?? reason.message); } else setError("Couldn't change your password. Please try again.");
    } finally { setBusy(false); }
  }

  if (!token) return <PortalCard title="Choose a new password" footer={<PortalLink href="/alumni-portal/forgot-password">Ask for a new link</PortalLink>}><Banner>This link is incomplete. Use the link from your email, or ask for a new one.</Banner></PortalCard>;
  if (done) return <PortalCard title="Password changed" footer={<PortalLink href="/alumni-portal/login">Sign in</PortalLink>}><Banner tone="success">Your password has been changed. Sign in with the new one.</Banner></PortalCard>;

  return (
    <PortalCard title="Choose a new password" footer={<PortalLink href="/alumni-portal/login">Back to sign in</PortalLink>}>
      {error ? <Banner>{error}</Banner> : null}
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormField label="New password" hint={PASSWORD_HINT} error={firstError(errors, 'password')}><input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></FormField>
        <FormField label="Type it again" error={firstError(errors, 'confirm')}><input className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></FormField>
        <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</Button>
      </form>
    </PortalCard>
  );
}
