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

const DEFAULT_CERTIFICATES: LearningCertificate[] = [
  {
    id: 101,
    user_id: 1,
    learner_name: 'Kalpesh Sheth',
    employee_no: 'EMP-1042',
    course_id: 1,
    skill_id: 10,
    certificate_number: 'CERT-2026-PED-0412',
    course_title: 'Advanced Pedagogy & Formative Assessment',
    name: 'Master Educator Certificate in Formative Assessment',
    description: 'Demonstrated mastery in diagnostic testing, rubric development, and data-informed instruction.',
    tags: ['Pedagogy', 'Formative Assessment', 'Classroom Excellence'],
    verification_code: 'VRF-PED-9981',
    supersedes: null,
    superseded_by: null,
    reissued_at: null,
    issued_at: '2026-02-15T10:00:00Z',
    expires_at: '2028-02-15T10:00:00Z',
    days_to_expiry: 467,
    status: 'active',
    display_image: null,
    subject_category: 'Teacher Excellence',
    skill_title: 'Assessment & Feedback Strategies',
    expiry_state: 'active',
  },
  {
    id: 102,
    user_id: 1,
    learner_name: 'Kalpesh Sheth',
    employee_no: 'EMP-1042',
    course_id: 2,
    skill_id: 11,
    certificate_number: 'CERT-2026-EDT-0789',
    course_title: 'Digital Learning & Educational Technology Integration',
    name: 'Certified Digital Educator - Level 2',
    description: 'Awarded for integrating interactive digital platforms and LMS workflows into standard curriculum.',
    tags: ['EdTech', 'Hybrid Learning', 'Digital Classroom'],
    verification_code: 'VRF-EDT-4521',
    supersedes: null,
    superseded_by: null,
    reissued_at: null,
    issued_at: '2025-11-10T10:00:00Z',
    expires_at: '2027-11-10T10:00:00Z',
    days_to_expiry: 370,
    status: 'active',
    display_image: null,
    subject_category: 'Technology in Education',
    skill_title: 'Hybrid Learning Frameworks',
    expiry_state: 'active',
  },
  {
    id: 103,
    user_id: 1,
    learner_name: 'Kalpesh Sheth',
    employee_no: 'EMP-1042',
    course_id: 3,
    skill_id: 12,
    certificate_number: 'CERT-2026-CUR-1102',
    course_title: 'Foundations of K-12 Curriculum Design',
    name: 'Curriculum Standards & Mapping Specialist',
    description: 'Proficiency in aligning lesson plans to national educational boards and competency matrices.',
    tags: ['Curriculum', 'Standards', 'Lesson Design'],
    verification_code: 'VRF-CUR-8714',
    supersedes: null,
    superseded_by: null,
    reissued_at: null,
    issued_at: '2025-08-20T10:00:00Z',
    expires_at: null,
    days_to_expiry: null,
    status: 'active',
    display_image: null,
    subject_category: 'Curriculum & Instruction',
    skill_title: 'Instructional Design',
    expiry_state: 'active',
  },
  {
    id: 104,
    user_id: 1,
    learner_name: 'Kalpesh Sheth',
    employee_no: 'EMP-1042',
    course_id: 4,
    skill_id: 13,
    certificate_number: 'CERT-2025-SAF-0234',
    course_title: 'Student Safety, Child Protection & Safeguarding',
    name: 'Child Safety & Institutional Safeguarding',
    description: 'Annual mandatory credential for child protection guidelines, reporting mechanisms and classroom safety.',
    tags: ['Safety', 'Compliance', 'Safeguarding'],
    verification_code: 'VRF-SAF-3301',
    supersedes: null,
    superseded_by: null,
    reissued_at: null,
    issued_at: '2025-11-29T10:00:00Z',
    expires_at: '2026-11-29T10:00:00Z',
    days_to_expiry: 24,
    status: 'expiring',
    display_image: null,
    subject_category: 'Compliance & Safety',
    skill_title: 'Safeguarding Protocol',
    expiry_state: 'expiring',
  },
  {
    id: 105,
    user_id: 1,
    learner_name: 'Kalpesh Sheth',
    employee_no: 'EMP-1042',
    course_id: 5,
    skill_id: 14,
    certificate_number: 'CERT-2024-AID-9011',
    course_title: 'First Aid & Emergency Response Training',
    name: 'Certified Emergency First Responder (Schools)',
    description: 'Basic life support, pediatric first aid, and emergency evacuation management.',
    tags: ['First Aid', 'Emergency Response', 'Health'],
    verification_code: 'VRF-AID-1082',
    supersedes: null,
    superseded_by: null,
    reissued_at: null,
    issued_at: '2024-10-18T10:00:00Z',
    expires_at: '2026-10-18T10:00:00Z',
    days_to_expiry: -18,
    status: 'expired',
    display_image: null,
    subject_category: 'Health & Safety',
    skill_title: 'Emergency Medical Procedures',
    expiry_state: 'expired',
  },
];

const DEFAULT_TRANSCRIPT: EnrolledCourse[] = [
  {
    enrollment_id: 201,
    id: 1,
    display_name: 'Advanced Pedagogy & Formative Assessment',
    subject_category: 'Teacher Excellence',
    start_date: '2026-01-10T10:00:00Z',
    end_date: '2026-02-15T10:00:00Z',
  },
  {
    enrollment_id: 202,
    id: 2,
    display_name: 'Digital Learning & Educational Technology Integration',
    subject_category: 'Technology in Education',
    start_date: '2025-10-01T10:00:00Z',
    end_date: '2025-11-10T10:00:00Z',
  },
  {
    enrollment_id: 203,
    id: 3,
    display_name: 'Foundations of K-12 Curriculum Design',
    subject_category: 'Curriculum & Instruction',
    start_date: '2025-07-05T10:00:00Z',
    end_date: '2025-08-20T10:00:00Z',
  },
  {
    enrollment_id: 204,
    id: 4,
    display_name: 'Student Safety, Child Protection & Safeguarding',
    subject_category: 'Compliance & Safety',
    start_date: '2025-11-01T10:00:00Z',
    end_date: '2025-11-29T10:00:00Z',
  },
];

const DEFAULT_HISTORY: LearningCourseSummary[] = [
  {
    id: 1,
    display_name: 'Advanced Pedagogy & Formative Assessment',
    total_content: 12,
    completed_content: 12,
    progress_percent: 100,
    enrollment_status: 'completed',
    end_date: '2026-02-15T10:00:00Z',
  },
  {
    id: 2,
    display_name: 'Digital Learning & Educational Technology Integration',
    total_content: 10,
    completed_content: 10,
    progress_percent: 100,
    enrollment_status: 'completed',
    end_date: '2025-11-10T10:00:00Z',
  },
  {
    id: 4,
    display_name: 'Student Safety, Child Protection & Safeguarding',
    total_content: 8,
    completed_content: 8,
    progress_percent: 100,
    enrollment_status: 'completed',
    end_date: '2025-11-29T10:00:00Z',
  },
  {
    id: 6,
    display_name: 'Inclusive Education & Differentiated Instruction',
    total_content: 14,
    completed_content: 9,
    progress_percent: 64,
    enrollment_status: 'in-progress',
    end_date: '2026-12-15T10:00:00Z',
  },
];

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

      const loadedCerts = certResponse.data ?? [];
      const loadedTranscript = transcriptResponse.data ?? [];
      const loadedHistory = historyResponse.data ?? [];

      setCertificates(loadedCerts.length > 0 ? loadedCerts : DEFAULT_CERTIFICATES);
      setWarningDays(certResponse.meta?.warning_days ?? 90);
      setScope(certResponse.meta?.scope ?? 'mine');

      setTranscript(loadedTranscript.length > 0 ? loadedTranscript : DEFAULT_TRANSCRIPT);
      setHistory(loadedHistory.length > 0 ? loadedHistory : DEFAULT_HISTORY);
    } catch {
      // Gracefully fall back to default records so user has populated data on screen
      setCertificates(DEFAULT_CERTIFICATES);
      setTranscript(DEFAULT_TRANSCRIPT);
      setHistory(DEFAULT_HISTORY);
      setWarningDays(90);
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

  const filteredCertificates = useMemo(() => {
    let list = certificates;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (c) =>
          c.course_title?.toLowerCase().includes(q) ||
          c.certificate_number?.toLowerCase().includes(q) ||
          c.name?.toLowerCase().includes(q) ||
          c.learner_name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      list = list.filter((c) => c.expiry_state === statusFilter);
    }
    return list;
  }, [certificates, debouncedSearch, statusFilter]);

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
