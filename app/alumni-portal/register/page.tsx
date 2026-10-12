'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Banner, FormField, inputClass } from '@/app/alumni/_components/alumni-ui';
import { PortalApiError, portalApi, portalSession } from '../_lib/portal-api';
import { PASSWORD_HINT, PortalCard, PortalLink, firstError } from '../_components/portal-ui';

export default function PortalRegisterPage() {
  return <Suspense fallback={null}><RegisterForm /></Suspense>;
}

function RegisterForm() {
  const params = useSearchParams();
  const [f, setF] = useState({ institute_code: params.get('i') ?? portalSession.institute(), first_name: '', last_name: '', email: '', mobile: '', batch: '', passing_year: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({}); setError('');
    const missing: Record<string, string[]> = {};
    if (!f.institute_code.trim()) missing.institute_code = ['Enter your institute code.'];
    if (!f.first_name.trim()) missing.first_name = ['Enter your first name.'];
    if (!f.last_name.trim()) missing.last_name = ['Enter your last name.'];
    if (!f.email.trim()) missing.email = ['Enter your email.'];
    if (!f.password) missing.password = ['Choose a password.'];
    if (Object.keys(missing).length) { setErrors(missing); return; }
    setBusy(true);
    try {
      const body: Parameters<typeof portalApi.register>[0] = { institute_code: f.institute_code.trim(), first_name: f.first_name.trim(), last_name: f.last_name.trim(), email: f.email.trim(), password: f.password };
      if (f.mobile.trim()) body.mobile = f.mobile.trim();
      if (f.batch.trim()) body.batch = f.batch.trim();
      if (f.passing_year.trim()) body.passing_year = Number(f.passing_year);
      setDone((await portalApi.register(body)).message);
      portalSession.rememberInstitute(f.institute_code.trim());
    } catch (reason) {
      if (reason instanceof PortalApiError) { setErrors(reason.fieldErrors); setError(reason.message); } else setError("Couldn't register you. Please try again.");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <PortalCard title="Check your email" footer={<PortalLink href="/alumni-portal/login">Back to sign in</PortalLink>}>
        <Banner tone="success">{done}</Banner>
        <p className="text-sm text-slate-600">After you confirm your email, you can sign in. The institute will then verify your registration before you can use everything in the portal.</p>
      </PortalCard>
    );
  }

  return (
    <PortalCard title="Create an account" intro="Register as an alumnus. The institute will verify your details." footer={<>Already registered? <PortalLink href="/alumni-portal/login">Sign in</PortalLink></>}>
      {error ? <Banner>{error}</Banner> : null}
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormField label="Institute code" required error={firstError(errors, 'institute_code')}><input className={inputClass} value={f.institute_code} onChange={(e) => set('institute_code', e.target.value)} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" required error={firstError(errors, 'first_name')}><input className={inputClass} value={f.first_name} onChange={(e) => set('first_name', e.target.value)} autoComplete="given-name" /></FormField>
          <FormField label="Last name" required error={firstError(errors, 'last_name')}><input className={inputClass} value={f.last_name} onChange={(e) => set('last_name', e.target.value)} autoComplete="family-name" /></FormField>
        </div>
        <FormField label="Email" required error={firstError(errors, 'email')}><input className={inputClass} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></FormField>
        <FormField label="Mobile" error={firstError(errors, 'mobile')}><input className={inputClass} value={f.mobile} onChange={(e) => set('mobile', e.target.value)} autoComplete="tel" /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Batch" error={firstError(errors, 'batch')}><input className={inputClass} placeholder="2017-18" value={f.batch} onChange={(e) => set('batch', e.target.value)} /></FormField>
          <FormField label="Year you left" error={firstError(errors, 'passing_year')}><input className={inputClass} type="number" value={f.passing_year} onChange={(e) => set('passing_year', e.target.value)} /></FormField>
        </div>
        <FormField label="Password" required hint={PASSWORD_HINT} error={firstError(errors, 'password')}><input className={inputClass} type="password" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" /></FormField>
        <Button type="submit" className="h-10 w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
      </form>
    </PortalCard>
  );
}
