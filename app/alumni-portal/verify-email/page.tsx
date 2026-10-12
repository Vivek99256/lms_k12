'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Banner } from '@/app/alumni/_components/alumni-ui';
import { PortalApiError, portalApi } from '../_lib/portal-api';
import { PortalCard, PortalLink } from '../_components/portal-ui';

export default function PortalVerifyEmailPage() {
  return <Suspense fallback={null}><Verify /></Suspense>;
}

// The link is NOT consumed just by opening the page: some mail scanners open every link, which would use a single-use token up
// before the person sees it. The person presses the button, and only then is the token used.
function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  async function confirm() {
    setState('working');
    try { setMessage((await portalApi.verifyEmail(token)).message); setState('done'); }
    catch (reason) {
      // the specific reason ("invalid or expired") travels as a field error; the top-level message is the generic one
      setMessage(reason instanceof PortalApiError ? (reason.fieldErrors.token?.[0] ?? reason.message) : "Couldn't confirm your email.");
      setState('failed');
    }
  }

  if (!token) return <PortalCard title="Confirm your email" footer={<PortalLink href="/alumni-portal/login">Sign in</PortalLink>}><Banner>This link is incomplete. Use the link from your email.</Banner></PortalCard>;
  return (
    <PortalCard title="Confirm your email" footer={<PortalLink href="/alumni-portal/login">Go to sign in</PortalLink>}>
      {state === 'done' ? <Banner tone="success">{message}</Banner> : null}
      {state === 'failed' ? <Banner>{message}</Banner> : null}
      {state === 'idle' || state === 'working' ? (
        <>
          <p className="text-sm text-slate-600">Press the button to confirm that this is your email address.</p>
          <Button className="h-10 w-full" disabled={state === 'working'} onClick={confirm}>{state === 'working' ? 'Confirming…' : 'Confirm my email'}</Button>
        </>
      ) : null}
    </PortalCard>
  );
}
