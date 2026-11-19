'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Calendar, GraduationCap, Loader2, Mail, MapPin, Phone, School } from 'lucide-react';

import { buildSessionContext, createAuthHeaders, readString } from '@/lib/erp-client';
import { friendlyError } from '@/lib/user-messages';

/**
 * My profile. Reads GET /api/own-profile, which answers for the signed-in user only (the id comes from the
 * verified session, never from the URL), so a student can only ever see their own record.
 */

interface OwnProfile {
  fullName: string;
  email: string;
  mobile: string;
  birthdate: string;
  joinYear: string;
  address: string;
  userProfile: string;
  schoolName: string;
}

function formatBirthdate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function Row({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 break-words text-sm text-slate-900">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const session = useMemo(() => buildSessionContext(), []);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${session.baseUrl}/api/own-profile`, {
          headers: createAuthHeaders(session),
          signal: controller.signal,
        });
        const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown> | null; message?: string };
        if (!res.ok || !body.data) throw new Error(body.message || 'Profile not found.');
        const d = body.data;
        setProfile({
          fullName: readString(d.full_name),
          email: readString(d.email),
          mobile: readString(d.mobile),
          birthdate: readString(d.birthdate),
          joinYear: readString(d.join_year),
          address: readString(d.address),
          userProfile: readString(d.user_profile),
          schoolName: readString(d.school_name),
        });
      } catch (err) {
        if (!controller.signal.aborted) setError(friendlyError(err, 'We couldn’t load your profile. Please try again.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [session]);

  const initial = profile?.fullName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link href="/teach-learn" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-20 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading profile…
          </div>
        ) : error || !profile ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error || 'Profile not found.'}
          </div>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-bold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-slate-900">{profile.fullName || 'My profile'}</h1>
                <p className="text-sm text-slate-500">
                  {profile.userProfile || 'Student'}
                  {session.syear ? ` · Academic year ${session.syear}` : ''}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
              <Row icon={School} label="School" value={profile.schoolName} />
              <Row icon={GraduationCap} label="Joined" value={profile.joinYear} />
              <Row icon={Mail} label="Email" value={profile.email} />
              <Row icon={Phone} label="Mobile" value={profile.mobile} />
              <Row icon={Calendar} label="Date of birth" value={formatBirthdate(profile.birthdate)} />
              <Row icon={MapPin} label="Address" value={profile.address} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
