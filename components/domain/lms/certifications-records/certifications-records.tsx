'use client';

/**
 * Certifications & Records — G2G LMS migration (Package 3).
 *
 * Ported from G2G's `components/domain/lms/records/certifications-records.tsx`
 * (`CertificationsRecords`). Markup, tabs, KPI cards and interaction behavior
 * are unchanged; only the data source (`use-lms-certifications.ts`, this
 * package's own port) and the primitive imports changed.
 *
 * Adaptations, matching `app/talent-management/certifications/components/
 * certifications-center.tsx`'s precedent for every other ported G2G screen:
 * - `@/components/ui/*` -> `@/components/ui/g2g/*` for Button, Card, Select,
 *   Table (the primitives whose API diverges from this repo's native
 *   versions); StatusBadge, Progress, SearchInput, Skeleton, EmptyState,
 *   ErrorState, Sheet family and AlertDialog family are unchanged, identical
 *   native primitives.
 */

import React, { useState } from 'react';
import { AlertCircle, Award, Clock, Download, GraduationCap, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/g2g/card';
import { Button } from '@/components/ui/g2g/button';
import { Select } from '@/components/ui/g2g/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/g2g/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useLmsCertifications } from './use-lms-certifications';
import type { CertificateVerification, LearningCertificate } from './certifications-records-service';
import { downloadCertificatePdf } from './certificate-pdf';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, 'dd MMM yyyy');
}

const STATE_VARIANT: Record<string, 'active' | 'pending' | 'error'> = {
  active: 'active',
  expiring: 'pending',
  expired: 'error',
};

const STATE_LABEL: Record<string, string> = {
  active: 'Active',
  expiring: 'Expiring Soon',
  expired: 'Expired',
};

/** Reads naturally in both directions: "in 44 days" / "Expired 42 days ago". */
function expiryHint(certificate: LearningCertificate) {
  if (certificate.days_to_expiry === null) return 'Never expires';
  if (certificate.days_to_expiry < 0) {
    return `Expired ${Math.abs(certificate.days_to_expiry)} days ago`;
  }
  return `in ${certificate.days_to_expiry} days`;
}

function toCsv(rows: string[][], filename: string) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = 'indigo',
  loading,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ElementType;
  variant?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  loading: boolean;
}) {
  const iconVariants = {
    indigo: 'bg-indigo-50 text-[#5846EA] border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-indigo-50/70 text-[#5846EA] border-indigo-100',
  };
  const hoverVariants = {
    indigo: 'hover:border-[#5846EA]/40',
    emerald: 'hover:border-emerald-400/50',
    amber: 'hover:border-amber-400/50',
    rose: 'hover:border-rose-400/50',
    slate: 'hover:border-[#5846EA]/40',
  };

  return (
    <Card className={cn("rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:shadow-sm", hoverVariants[variant])}>
      <CardContent className="p-0 flex items-center gap-4">
        <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs", iconVariants[variant])}>
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-12" />
          ) : (
            <h3 className="text-2xl font-black tracking-tight text-slate-900">{value}</h3>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Shared certificate table ─────────────────────────────────────────────── */

function CertificateTable({
  certificates,
  loading,
  showLearner,
  onSelect,
  emptyTitle = 'No certificates yet',
  emptyDescription = 'Certificates appear here once a course is completed.',
}: {
  certificates: LearningCertificate[];
  loading: boolean;
  showLearner: boolean;
  onSelect: (certificate: LearningCertificate) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xs">
        <EmptyState icon={<Award className="size-8 text-[#5846EA]" />} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Certificate</TableHead>
            {showLearner && <TableHead>Learner</TableHead>}
            <TableHead>Credential ID</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certificates.map((certificate) => (
            <TableRow key={certificate.id} className="cursor-pointer hover:bg-slate-50/60 transition-colors" onClick={() => onSelect(certificate)}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'size-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs',
                      certificate.expiry_state === 'expired'
                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                        : certificate.expiry_state === 'expiring'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    )}
                  >
                    <Award className="size-4" />
                  </div>
                  <span className="font-semibold text-foreground">{certificate.course_title ?? 'Certificate'}</span>
                </div>
              </TableCell>
              {showLearner && (
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="size-6 rounded-full bg-indigo-50 text-[#5846EA] text-[10px] font-bold border border-indigo-100 flex items-center justify-center shrink-0">
                      {(certificate.learner_name ?? 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <span>{certificate.learner_name || '—'}</span>
                    {certificate.employee_no && (
                      <span className="text-[11px] text-muted-foreground">({certificate.employee_no})</span>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell>
                <span className="font-mono text-xs text-[#5846EA] font-semibold bg-indigo-50/60 px-2 py-0.5 rounded border border-indigo-100/60">
                  {certificate.certificate_number}
                </span>
              </TableCell>
              <TableCell>{formatDate(certificate.issued_at)}</TableCell>
              <TableCell>
                {certificate.expires_at ? (
                  <div className="flex flex-col">
                    <span>{formatDate(certificate.expires_at)}</span>
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        certificate.expiry_state === 'expired'
                          ? 'text-rose-600'
                          : certificate.expiry_state === 'expiring'
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                      )}
                    >
                      {expiryHint(certificate)}
                    </span>
                  </div>
                ) : (
                  'Never'
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  variant={STATE_VARIANT[certificate.expiry_state] ?? 'active'}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  {STATE_LABEL[certificate.expiry_state] ?? certificate.expiry_state}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function CertificationsRecords() {
  const {
    certificates, transcript, history, renewals,
    kpis, warningDays, isOrgWide,
    loading, error, reload,
    search, setSearch, statusFilter, setStatusFilter,
    filteredCertificates,
    canReissue, certificateUrl, reissue, verify,
    busy, message, actionError, dismiss,
  } = useLmsCertifications();

  const [activeTab, setActiveTab] = useState('certificates');
  const [selected, setSelected] = useState<LearningCertificate | null>(null);
  const [confirmReissue, setConfirmReissue] = useState<LearningCertificate | null>(null);
  const [verification, setVerification] = useState<CertificateVerification | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async (certificate: LearningCertificate) => {
    setDownloadingPdf(true);
    try {
      // First attempt downloading via backend URL if reachable and returns valid PDF
      const url = certificateUrl(certificate.id);
      const res = await fetch(url, { method: 'GET' });
      if (res.ok && res.headers.get('content-type')?.includes('application/pdf')) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${certificate.certificate_number || 'certificate'}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        setDownloadingPdf(false);
        return;
      }
    } catch {
      // Fall through to high-resolution client-side generator
    }

    // Direct high-resolution client-side generation ensures instant, guaranteed PDF download
    try {
      await downloadCertificatePdf(certificate);
    } catch (err) {
      console.error('Failed to generate certificate PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const tabs = [
    { id: 'certificates', label: 'Certificates', badge: certificates.length },
    { id: 'transcript', label: 'Learning Transcript', badge: transcript.length },
    { id: 'history', label: 'Completion History', badge: history.length },
    { id: 'renewals', label: 'Renewals Due', badge: renewals.length },
  ];

  const exportCertificates = () =>
    toCsv(
      [
        ['Credential ID', ...(isOrgWide ? ['Learner'] : []), 'Course', 'Issued', 'Valid Until', 'Status'],
        ...filteredCertificates.map((certificate) => [
          certificate.certificate_number,
          ...(isOrgWide ? [certificate.learner_name ?? ''] : []),
          certificate.course_title ?? '',
          formatDate(certificate.issued_at),
          certificate.expires_at ? formatDate(certificate.expires_at) : 'Never',
          STATE_LABEL[certificate.expiry_state] ?? certificate.expiry_state,
        ]),
      ],
      `certificates-${new Date().toISOString().slice(0, 10)}.csv`
    );

  const exportTranscript = () =>
    toCsv(
      [
        ['Course', 'Category', 'Started', 'Completed'],
        ...transcript.map((course) => [
          course.display_name ?? '',
          course.subject_category ?? '',
          formatDate(course.start_date),
          formatDate(course.end_date),
        ]),
      ],
      `transcript-${new Date().toISOString().slice(0, 10)}.csv`
    );

  if (error && !loading && certificates.length === 0) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load records" description={error} retry={reload} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6" style={{ ['--primary' as string]: '#5846EA' }}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Certifications &amp; Records</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOrgWide
              ? 'Certificates and completion records across your organisation.'
              : 'Your certificates and completed learning.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-slate-200 text-slate-700 hover:border-[#5846EA]/40 hover:text-[#5846EA] hover:bg-indigo-50/50 font-semibold shadow-xs transition-colors"
            onClick={exportCertificates}
            disabled={filteredCertificates.length === 0}
          >
            <Download className="size-4 text-[#5846EA]" /> Export
          </Button>
          <Button
            className="gap-2 bg-[#5846EA] text-white hover:bg-[#4936d8] font-semibold shadow-xs transition-all"
            onClick={exportTranscript}
            disabled={transcript.length === 0}
          >
            <Download className="size-4" /> Download Transcript
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Active Certificates" value={kpis.active} sub="Currently valid" icon={Award} variant="emerald" loading={loading} />
        <KpiCard
          label="Expiring Soon"
          value={kpis.expiring}
          sub={`Within ${warningDays} days`}
          icon={Clock}
          variant="amber"
          loading={loading}
        />
        <KpiCard label="Expired" value={kpis.expired} sub="Require renewal" icon={AlertCircle} variant="rose" loading={loading} />
        <KpiCard label="Total Earned" value={kpis.total} sub="All time" icon={Award} variant="indigo" loading={loading} />
      </div>

      <div className="flex items-center gap-6 overflow-x-auto border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap pb-3 text-sm font-bold outline-none transition-colors',
              activeTab === tab.id ? 'text-[#5846EA]' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-black',
                activeTab === tab.id
                  ? 'bg-indigo-50 text-[#5846EA] border border-indigo-100'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {tab.badge}
            </span>
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-t-full bg-[#5846EA]" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'certificates' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-72">
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isOrgWide ? 'Search by course, credential or learner...' : 'Search by course or credential...'
                }
              />
            </div>
            <div className="w-44">
              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(String(value))}
                aria-label="Filter by status"
                options={[
                  { label: 'All statuses', value: '' },
                  { label: 'Active', value: 'active' },
                  { label: 'Expiring soon', value: 'expiring' },
                  { label: 'Expired', value: 'expired' },
                ]}
              />
            </div>
          </div>

          <CertificateTable
            certificates={filteredCertificates}
            loading={loading}
            showLearner={isOrgWide}
            onSelect={setSelected}
          />
        </>
      )}

      {activeTab === 'transcript' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : transcript.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<GraduationCap className="size-8 text-[#5846EA]" />}
                title="No completed courses"
                description="Courses you finish appear on your transcript."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transcript.map((course) => (
                  <TableRow key={course.enrollment_id ?? course.id} className="hover:bg-slate-50/60">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <GraduationCap className="size-3.5 text-[#5846EA]" />
                        </div>
                        <span className="font-semibold text-foreground">
                          {course.display_name ?? 'Untitled course'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{course.subject_category || '—'}</TableCell>
                    <TableCell>{formatDate(course.start_date)}</TableCell>
                    <TableCell>{formatDate(course.end_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<GraduationCap className="size-8 text-[#5846EA]" />}
                title="No learning history"
                description="Courses you are enrolled in appear here with their progress."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Lessons</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((course) => (
                  <TableRow key={course.id} className="hover:bg-slate-50/60">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <GraduationCap className="size-3.5 text-[#5846EA]" />
                        </div>
                        <span className="font-semibold text-foreground">
                          {course.display_name ?? 'Untitled course'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {course.completed_content}/{course.total_content}
                    </TableCell>
                    <TableCell>
                      <div className="flex w-28 flex-col gap-1">
                        <span className="text-[11px] font-bold text-foreground">{course.progress_percent}%</span>
                        <Progress value={course.progress_percent} className="h-1.5 bg-slate-100 [&>div]:bg-[#5846EA]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={course.enrollment_status === 'completed' ? 'active' : 'processing'}
                        className="text-[10px] font-bold uppercase tracking-wider"
                      >
                        {course.enrollment_status ?? '—'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{formatDate(course.end_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {activeTab === 'renewals' && (
        <>
          <p className="text-sm text-muted-foreground">
            Certificates expiring within {warningDays} days, or already expired — soonest first.
          </p>
          <CertificateTable
            certificates={renewals}
            loading={loading}
            showLearner={isOrgWide}
            onSelect={setSelected}
            emptyTitle="Nothing to renew"
            emptyDescription={`No certificate expires within ${warningDays} days.`}
          />
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.course_title ?? 'Certificate'}</SheetTitle>
                <SheetDescription className="font-mono text-xs">{selected.certificate_number}</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 pt-2">
                <StatusBadge
                  variant={STATE_VARIANT[selected.expiry_state] ?? 'active'}
                  className="w-fit text-[10px] font-bold uppercase tracking-wider"
                >
                  {STATE_LABEL[selected.expiry_state] ?? selected.expiry_state}
                </StatusBadge>

                <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                  {isOrgWide && (
                    <>
                      <span className="font-medium text-muted-foreground">Learner</span>
                      <span className="font-semibold text-foreground">
                        {selected.learner_name || '—'}
                        {selected.employee_no ? ` (${selected.employee_no})` : ''}
                      </span>
                    </>
                  )}
                  <span className="font-medium text-muted-foreground">Issued on</span>
                  <span className="font-semibold text-foreground">{formatDate(selected.issued_at)}</span>
                  <span className="font-medium text-muted-foreground">Valid until</span>
                  <span className="font-semibold text-foreground">
                    {selected.expires_at ? formatDate(selected.expires_at) : 'Never expires'}
                  </span>
                  <span className="font-medium text-muted-foreground">Expiry</span>
                  <span className="font-semibold text-foreground">{expiryHint(selected)}</span>
                  {selected.subject_category && (
                    <>
                      <span className="font-medium text-muted-foreground">Category</span>
                      <span className="font-semibold text-foreground">{selected.subject_category}</span>
                    </>
                  )}
                  {selected.verification_code && (
                    <>
                      <span className="font-medium text-muted-foreground">Verify code</span>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {selected.verification_code}
                      </span>
                    </>
                  )}
                  {selected.supersedes && (
                    <>
                      <span className="font-medium text-muted-foreground">Replaces</span>
                      <span className="font-semibold text-foreground">certificate #{selected.supersedes}</span>
                    </>
                  )}
                  {selected.superseded_by && (
                    <>
                      <span className="font-medium text-muted-foreground">Replaced by</span>
                      <span className="font-semibold text-foreground">certificate #{selected.superseded_by}</span>
                    </>
                  )}
                </div>

                {selected.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
                )}

                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {selected.skill_title && (
                  <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    Counts towards <span className="font-semibold text-foreground">{selected.skill_title}</span> in
                    the competency framework.
                  </p>
                )}

                {verification && (
                  <div
                    className={cn(
                      'rounded-lg border p-3 text-xs',
                      verification.valid
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-destructive/40 bg-destructive/10 text-destructive'
                    )}
                  >
                    <p className="font-semibold">{verification.valid ? 'Valid credential' : 'Not valid'}</p>
                    <p className="mt-0.5 opacity-90">{verification.message}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-2 bg-[#5846EA] text-white hover:bg-[#4936d8] transition-all font-semibold shadow-xs"
                    disabled={downloadingPdf}
                    onClick={() => void handleDownloadPdf(selected)}
                  >
                    {downloadingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Download PDF
                  </Button>

                  {selected.verification_code && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={busy}
                      onClick={() => {
                        void verify(selected.verification_code as string).then(setVerification);
                      }}
                    >
                      <ShieldCheck className="size-4" /> Verify
                    </Button>
                  )}

                  {canReissue && !selected.superseded_by && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={busy}
                      onClick={() => setConfirmReissue(selected)}
                    >
                      <RefreshCw className="size-4" /> Re-issue
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmReissue !== null} onOpenChange={(open) => !open && setConfirmReissue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-issue this certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmReissue?.certificate_number} will be marked superseded and kept on record. A new credential is
              issued with a fresh validity period — {confirmReissue?.learner_name || 'the learner'}&apos;s course
              progress is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmReissue(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                const target = confirmReissue;
                if (!target) return;
                void reissue(target.id).then((result) => {
                  setConfirmReissue(null);
                  if (result.ok) {
                    setSelected(null);
                    setVerification(null);
                  }
                });
              }}
            >
              {busy ? 'Re-issuing…' : 'Re-issue'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(message || actionError) && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
            actionError
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-success/40 bg-success/10 text-success'
          )}
        >
          <span className="font-medium">{actionError ?? message}</span>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
