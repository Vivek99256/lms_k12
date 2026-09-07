'use client';

/**
 * Ported from G2G's `hooks/use-certifications.ts` (`useLmsCertifications`
 * only — the Certification & Compliance Center half of that file,
 * `useCertifications`/`useCertificationDetail`/`useCertificationRequirements`,
 * belongs to the ALREADY-PORTED screen at `app/talent-management/certifications`
 * and is not duplicated here).
 *
 * Adaptations:
 * - `useAuth()` / `getLaravelContext(user)` -> `buildSessionContext()` from
 *   `certifications-records-service.ts`, matching every other ported G2G
 *   screen in this repo.
 * - `canSeeAll` / `canReissue` was `user.role === 'admin' || user.role === 'hr'`.
 *   This repo's `SessionContext` carries `isAdmin` (from the hydrated
 *   session's `is_admin`), which is the same admin gate the backend enforces
 *   server-side (`isLmsStaffAdmin()`); the client-side flag here only decides
 *   what to REQUEST and which buttons to show; the server is the real gate.
 * - `transcript` / `history` (My Learning transcript + completion history)
 *   now come from this package's own `transcript`/`completionHistory`
 *   endpoints instead of Package 1's dashboard/learning services — see the
 *   service file's doc-comment.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildSessionContext,
  lmsCertificationsRecordsService,
  type CertificateVerification,
  type EnrolledCourse,
  type LearningCertificate,
  type LearningCourseSummary,
} from './certifications-records-service';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface CertificationKpis {
  active: number;
  expiring: number;
  expired: number;
  total: number;
}

export interface CertificationsState {
  certificates: LearningCertificate[];
  transcript: EnrolledCourse[];
  history: LearningCourseSummary[];
  renewals: LearningCertificate[];

  kpis: CertificationKpis;
  warningDays: number;
  scope: 'mine' | 'all';
  isOrgWide: boolean;

  loading: boolean;
  error: string | null;
  reload: () => void;

  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;

  filteredCertificates: LearningCertificate[];

  canReissue: boolean;
  certificateUrl: (certificateId: number) => string;
  reissue: (certificateId: number) => Promise<{ ok: boolean; message: string }>;
  verify: (code: string) => Promise<CertificateVerification | null>;

  busy: boolean;
  message: string | null;
  actionError: string | null;
  dismiss: () => void;
}

export function useLmsCertifications(): CertificationsState {
  const session = useMemo(() => buildSessionContext(), []);
  const canSeeAll = session.isAdmin === '1' || session.isAdmin === '2';

  const [certificates, setCertificates] = useState<LearningCertificate[]>([]);
  const [transcript, setTranscript] = useState<EnrolledCourse[]>([]);
  const [history, setHistory] = useState<LearningCourseSummary[]>([]);
  const [warningDays, setWarningDays] = useState(90);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!session.token) {
      setLoading(false);
      setError('Your session has expired. Sign in again to view records.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [certResponse, transcriptResponse, historyResponse] = await Promise.all([
        lmsCertificationsRecordsService.list(session, {
          scope: canSeeAll ? 'all' : 'mine',
          search: debouncedSearch || undefined,
        }),
        lmsCertificationsRecordsService.transcript(session),
        lmsCertificationsRecordsService.completionHistory(session),
      ]);

      setCertificates(certResponse.data ?? []);
      setWarningDays(certResponse.meta?.warning_days ?? 90);
      setScope(certResponse.meta?.scope ?? 'mine');

      setTranscript(transcriptResponse.data ?? []);
      setHistory(historyResponse.data ?? []);
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load certifications and records.'));
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }, [session, canSeeAll, debouncedSearch]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const kpis = useMemo<CertificationKpis>(
    () => ({
      active: certificates.filter((c) => c.expiry_state === 'active').length,
      expiring: certificates.filter((c) => c.expiry_state === 'expiring').length,
      expired: certificates.filter((c) => c.expiry_state === 'expired').length,
      total: certificates.length,
    }),
    [certificates]
  );

  const renewals = useMemo(
    () =>
      certificates
        .filter((c) => c.expiry_state === 'expiring' || c.expiry_state === 'expired')
        .sort((a, b) => (a.days_to_expiry ?? 0) - (b.days_to_expiry ?? 0)),
    [certificates]
  );

  const certificateUrl = useCallback(
    (certificateId: number) => lmsCertificationsRecordsService.downloadUrl(session, certificateId),
    [session]
  );

  const reissue = useCallback(
    async (certificateId: number) => {
      setBusy(true);
      setActionError(null);
      setMessage(null);

      try {
        const response = await lmsCertificationsRecordsService.reissue(session, certificateId);
        await load();

        const success = response.data?.certificate_number
          ? `Re-issued as ${response.data.certificate_number}.`
          : 'Certificate re-issued.';
        setMessage(success);
        return { ok: true, message: success };
      } catch (reissueError) {
        const failure = toMessage(reissueError, 'Failed to re-issue the certificate.');
        setActionError(failure);
        return { ok: false, message: failure };
      } finally {
        setBusy(false);
      }
    },
    [session, load]
  );

  const verify = useCallback(
    async (code: string) => {
      setBusy(true);
      setActionError(null);

      try {
        const response = await lmsCertificationsRecordsService.verify(session, code);
        if (!response.data) return null;
        return { ...response.data, valid: response.valid ?? false, message: response.message ?? '' };
      } catch (verifyError) {
        setActionError(toMessage(verifyError, 'That certificate could not be verified.'));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [session]
  );

  const filteredCertificates = useMemo(
    () => (statusFilter ? certificates.filter((c) => c.expiry_state === statusFilter) : certificates),
    [certificates, statusFilter]
  );

  return {
    certificates,
    transcript,
    history,
    renewals,

    kpis,
    warningDays,
    scope,
    isOrgWide: scope === 'all',

    loading,
    error,
    reload: () => void load(),

    search,
    setSearch,
    statusFilter,
    setStatusFilter,

    filteredCertificates,

    canReissue: canSeeAll,
    certificateUrl,
    reissue,
    verify,

    busy,
    message,
    actionError,
    dismiss: () => {
      setMessage(null);
      setActionError(null);
    },
  };
}
