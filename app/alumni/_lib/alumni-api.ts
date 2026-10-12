'use client';

import { asRecord, getFeesSession, readString } from '@/app/fees/_lib/fees-api';

/**
 * Alumni API client. Every call goes through the Next relay (`/api/proxy?path=api/alumni/...`)
 * with the session's bearer token; the tenant comes from the token on the server, so nothing
 * tenant-related is sent from here.
 *
 * Unlike the shared fees helper, this keeps Laravel's 422 `errors` object and the 409
 * duplicate `matches`, so forms can show backend validation next to the field.
 */

export class AlumniApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;
  matches: DuplicateMatch[];

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}, matches: DuplicateMatch[] = []) {
    super(message);
    this.name = 'AlumniApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.matches = matches;
  }
}

export type DuplicateMatch = { id: number; alumni_code: string; full_name: string; matched_on: string[] };

export type AlumniStatus =
  | 'registered' | 'pending_verification' | 'verified' | 'active'
  | 'inactive' | 'blocked' | 'deceased' | 'opted_out';

export type AlumniRow = {
  id: number;
  alumni_code: string;
  student_id: number | null;
  source: string;
  full_name: string;
  gender: string | null;
  email: string | null;
  mobile: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  batch: string | null;
  passing_year: number | null;
  last_class: string | null;
  status: AlumniStatus;
  employment_status: string | null;
  current_company: string | null;
  current_industry: string | null;
  current_job_title: string | null;
  profile_completion: number;
  created_at: string;
  last_activity_at: string | null;
};

export type AlumniDetail = AlumniRow & Record<string, string | number | null>;

export type Pagination = { page: number; per_page: number; total: number; last_page: number };

export type ListFilters = {
  q?: string; status?: string; batch?: string; passing_year?: string; city?: string; state?: string;
  country?: string; industry?: string; company?: string; job_role?: string; employment_status?: string;
  skill?: string; higher_education?: string; source?: string; admission_year?: string; course?: string; department?: string; campus?: string;
  sort?: string; dir?: 'asc' | 'desc'; page?: number; per_page?: number;
};

type Query = Record<string, string | number | undefined | null>;

async function request<T>(method: 'GET' | 'POST', path: string, opts: { query?: Query; body?: unknown; signal?: AbortSignal } = {}): Promise<{ data: T; message: string }> {
  const session = getFeesSession();
  const params = new URLSearchParams({ path: `api/alumni/${path}` });
  Object.entries(opts.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });

  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`/api/proxy?${params.toString()}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: 'include',
    });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') throw reason;
    throw new AlumniApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? asRecord(JSON.parse(text)) : {};
  } catch {
    throw new AlumniApiError("Couldn't read the response. Try again.", response.status);
  }

  const message = readString(payload.message);
  if (!response.ok || Number(payload.status_code ?? payload.status) !== 1) {
    const fieldErrors = withTypeErrors(asRecord(payload.errors) as Record<string, string[]>);
    const matches = Array.isArray(payload.matches) ? (payload.matches as DuplicateMatch[]) : [];
    const fallback =
      response.status === 403 ? "You don't have access to alumni management."
      : response.status === 404 ? "That alumni record wasn't found."
      : "Couldn't complete the request. Try again.";
    throw new AlumniApiError(message || fallback, response.status, fieldErrors, matches);
  }
  return { data: payload.data as T, message };
}

export const alumniApi = {
  list: (filters: ListFilters, signal?: AbortSignal) =>
    request<{ rows: AlumniRow[]; pagination: Pagination }>('GET', 'list', { query: filters as Query, signal }).then((r) => r.data),
  meta: (signal?: AbortSignal) => request<AlumniMeta>('GET', 'meta', { signal }).then((r) => r.data),
  dashboard: (signal?: AbortSignal) => request<AlumniDashboard>('GET', 'dashboard', { signal }).then((r) => r.data),
  show: (id: number | string, signal?: AbortSignal) => request<AlumniProfile>('GET', String(id), { signal }).then((r) => r.data),
  academicHistory: (id: number | string, signal?: AbortSignal) =>
    request<{ linked: boolean; rows: AcademicRow[] }>('GET', `${id}/academic-history`, { signal }).then((r) => r.data),
  create: (body: Record<string, unknown>) => request<AlumniDetail>('POST', 'store', { body }),
  update: (id: number | string, body: Record<string, unknown>) => request<AlumniDetail>('POST', `${id}/update`, { body }),
  setStatus: (id: number | string, status: AlumniStatus, remarks?: string) =>
    request<AlumniDetail>('POST', `${id}/status`, { body: { status, remarks } }),
  verify: (id: number | string, decision: 'approve' | 'reject', remarks?: string) =>
    request<AlumniDetail>('POST', `${id}/verify`, { body: { decision, remarks } }),
  childSave: (id: number | string, kind: ChildKind, body: Record<string, unknown>, rid?: number) =>
    request<Record<string, unknown>>('POST', rid ? `${id}/${kind}/${rid}/update` : `${id}/${kind}/store`, { body }),
  childDelete: (id: number | string, kind: ChildKind, rid: number) => request<null>('POST', `${id}/${kind}/${rid}/delete`, { body: {} }),
  conversionPreview: (signal?: AbortSignal) =>
    request<ConversionPreview>('GET', 'conversion/preview', { signal }).then((r) => r.data),
  conversionRun: (body: { student_ids?: number[]; confirm_all?: boolean }) =>
    request<{ created: number; already_alumni: number; skipped: { student_id: number; reason: string }[] }>('POST', 'conversion/run', { body }),
  settings: (signal?: AbortSignal) => request<AlumniSettings>('GET', 'settings', { signal }).then((r) => r.data),
  saveSettings: (body: Partial<AlumniSettings>) => request<AlumniSettings>('POST', 'settings', { body }),

  directory: (filters: DirectoryFilters, signal?: AbortSignal) =>
    request<{ rows: DirectoryRow[]; pagination: Pagination }>('GET', 'directory', { query: filters as Query, signal }).then((r) => r.data),
  directoryOptions: (signal?: AbortSignal) => request<DirectoryOptions>('GET', 'directory/options', { signal }).then((r) => r.data),
  batches: (groupBy: BatchGroup, signal?: AbortSignal) =>
    request<BatchStats>('GET', 'batches', { query: { group_by: groupBy }, signal }).then((r) => r.data),
  privacy: (id: number | string, signal?: AbortSignal) => request<PrivacyPayload>('GET', `${id}/privacy`, { signal }).then((r) => r.data),
  savePrivacy: (id: number | string, body: { fields?: Record<string, string>; consents?: Record<string, boolean> }) =>
    request<PrivacyPayload>('POST', `${id}/privacy`, { body }),

  documents: (id: number | string, signal?: AbortSignal) =>
    request<{ types: string[]; max_kb: number; rows: AlumniDocument[] }>('GET', `${id}/documents`, { signal }).then((r) => r.data),
  uploadDocument: (id: number | string, file: File, docType: string, remarks?: string) => {
    const form = new FormData();
    form.set('file', file);
    form.set('doc_type', docType);
    if (remarks) form.set('remarks', remarks);
    return requestForm<AlumniDocument>(`${id}/documents/upload`, form);
  },
  verifyDocument: (id: number | string, docId: number, decision: 'verified' | 'rejected', remarks?: string) =>
    request<AlumniDocument>('POST', `${id}/documents/${docId}/verify`, { body: { decision, remarks } }),
  deleteDocument: (id: number | string, docId: number) => request<null>('POST', `${id}/documents/${docId}/delete`, { body: {} }),
  downloadDocument: (id: number | string, docId: number) => downloadBinary(`${id}/documents/${docId}/download`, {}),
  verifyAchievement: (id: number | string, rid: number, decision: 'verified' | 'rejected', documentId?: number) =>
    request<Record<string, unknown>>('POST', `${id}/achievements/${rid}/verify`, { body: { decision, document_id: documentId } }),

  exportAlumni: (filters: ListFilters, format: 'csv' | 'xlsx', ids?: number[]) =>
    downloadBinary('export', { ...stripPaging(filters), format, ...(ids?.length ? { ids } : {}) }),
  bulkStatus: (ids: number[], status: AlumniStatus, remarks?: string) =>
    request<{ updated: number; not_found: number[] }>('POST', 'bulk-status', { body: { ids, status, remarks } }),

  // ---- engagement
  engagementOverview: (signal?: AbortSignal) => request<EngagementOverview>('GET', 'engagement/overview', { signal }).then((r) => r.data),
  engagementLeaderboard: (signal?: AbortSignal) => request<LeaderboardRow[]>('GET', 'engagement/leaderboard', { signal }).then((r) => r.data),
  engagementActivities: (query: { type?: string; alumni_id?: number; page?: number }, signal?: AbortSignal) =>
    request<{ rows: ActivityRow[]; pagination: Pagination }>('GET', 'engagement/activities', { query: { engagement_type: query.type, alumni_id: query.alumni_id, page: query.page }, signal }).then((r) => r.data),
  recordEngagement: (body: { alumni_id: number; type: string; title: string; occurred_on?: string; points?: number; detail?: string }) =>
    request<{ id: number; score: number; level: string }>('POST', 'engagement/record', { body: renameType(body, 'engagement_type') }),
  deleteEngagement: (id: number) => request<null>('POST', `engagement/activities/${id}/delete`, { body: {} }),
  alumnusEngagement: (id: number | string, signal?: AbortSignal) =>
    request<AlumnusEngagement>('GET', `${id}/engagement`, { signal }).then((r) => r.data),

  // ---- mentorship (staff)
  mentors: (signal?: AbortSignal) => request<MentorRow[]>('GET', 'mentorship/mentors', { signal }).then((r) => r.data),
  saveMentor: (body: Record<string, unknown>, id?: number) =>
    request<Record<string, unknown>>('POST', id ? `mentorship/mentors/${id}/update` : 'mentorship/mentors/store', { body }),
  deleteMentor: (id: number) => request<null>('POST', `mentorship/mentors/${id}/delete`, { body: {} }),
  searchStudents: (q: string, signal?: AbortSignal) =>
    request<StudentHit[]>('GET', 'mentorship/students', { query: { q }, signal }).then((r) => r.data),
  mentorshipRequests: (query: { status?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: MentorshipRequestRow[]; pagination: Pagination }>('GET', 'mentorship/requests', { query: query as Query, signal }).then((r) => r.data),
  mentorshipRequest: (id: number, signal?: AbortSignal) => request<MentorshipDetail>('GET', `mentorship/requests/${id}`, { signal }).then((r) => r.data),
  createMentorshipRequest: (body: Record<string, unknown>) => request<Record<string, unknown>>('POST', 'mentorship/requests/store', { body }),
  mentorMatches: (id: number, signal?: AbortSignal) => request<MentorMatch[]>('GET', `mentorship/requests/${id}/matches`, { signal }).then((r) => r.data),
  matchMentor: (id: number, mentorAlumniId: number) => request<Record<string, unknown>>('POST', `mentorship/requests/${id}/match`, { body: { mentor_alumni_id: mentorAlumniId } }),
  respondToRequest: (id: number, decision: 'accept' | 'decline', note?: string) =>
    request<Record<string, unknown>>('POST', `mentorship/requests/${id}/respond`, { body: { decision, note } }),
  cancelMentorshipRequest: (id: number) => request<Record<string, unknown>>('POST', `mentorship/requests/${id}/cancel`, { body: {} }),
  completeMentorshipRequest: (id: number) => request<Record<string, unknown>>('POST', `mentorship/requests/${id}/complete`, { body: {} }),
  scheduleSession: (id: number, body: { scheduled_at: string; duration_minutes?: number; mode?: string; location?: string }) =>
    request<Record<string, unknown>>('POST', `mentorship/requests/${id}/sessions/store`, { body }),
  updateSession: (sid: number, status: 'completed' | 'cancelled' | 'no_show', notes?: string) =>
    request<Record<string, unknown>>('POST', `mentorship/sessions/${sid}/update`, { body: { status, notes } }),
  sessionFeedback: (sid: number, fromRole: 'student' | 'mentor', rating: number, comments?: string) =>
    request<Record<string, unknown>>('POST', `mentorship/sessions/${sid}/feedback`, { body: { from_role: fromRole, rating, comments } }),

  // ---- opportunities (staff)
  opportunities: (query: { status?: string; type?: string; q?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: OpportunityRow[]; types: string[]; approval_required: boolean; pagination: Pagination }>('GET', 'opportunities', { query: { status: query.status, opportunity_type: query.type, q: query.q, page: query.page }, signal }).then((r) => r.data),
  saveOpportunity: (body: Record<string, unknown>, id?: number) =>
    request<OpportunityRow>('POST', id ? `opportunities/${id}/update` : 'opportunities/store', { body: renameType(body, 'opportunity_type') }),
  reviewOpportunity: (id: number, decision: 'approve' | 'reject', remarks?: string) =>
    request<OpportunityRow>('POST', `opportunities/${id}/review`, { body: { decision, remarks } }),
  closeOpportunity: (id: number) => request<OpportunityRow>('POST', `opportunities/${id}/close`, { body: {} }),
  deleteOpportunity: (id: number) => request<null>('POST', `opportunities/${id}/delete`, { body: {} }),

  // ---- communication
  commMeta: (signal?: AbortSignal) => request<CommMeta>('GET', 'communication/meta', { signal }).then((r) => r.data),
  templates: (signal?: AbortSignal) => request<MessageTemplate[]>('GET', 'communication/templates', { signal }).then((r) => r.data),
  saveTemplate: (body: Record<string, unknown>, id?: number) =>
    request<MessageTemplate>('POST', id ? `communication/templates/${id}/update` : 'communication/templates/store', { body }),
  deleteTemplate: (id: number) => request<null>('POST', `communication/templates/${id}/delete`, { body: {} }),
  previewAudience: (body: { channels: string[]; filters: Record<string, string> }) =>
    request<AudiencePreview>('POST', 'communication/preview', { body }).then((r) => r.data),
  sendCampaign: (body: Record<string, unknown>) => request<Campaign>('POST', 'communication/send', { body }),
  campaigns: (page: number, signal?: AbortSignal) =>
    request<{ rows: Campaign[]; pagination: Pagination }>('GET', 'communication/campaigns', { query: { page }, signal }).then((r) => r.data),
  campaign: (id: number, signal?: AbortSignal) => request<CampaignDetail>('GET', `communication/campaigns/${id}`, { signal }).then((r) => r.data),
  sendDraftCampaign: (id: number) => request<Campaign>('POST', `communication/campaigns/${id}/send`, { body: {} }),
  cancelCampaign: (id: number) => request<Campaign>('POST', `communication/campaigns/${id}/cancel`, { body: {} }),
  history: (query: { channel?: string; status?: string; comm_type?: string; alumni_id?: number; campaign_id?: number; page?: number }, signal?: AbortSignal) =>
    request<{ rows: HistoryRow[]; pagination: Pagination }>('GET', 'communication/history', { query: query as Query, signal }).then((r) => r.data),
  alumnusHistory: (id: number | string, signal?: AbortSignal) =>
    request<{ rows: HistoryRow[] }>('GET', `${id}/communication`, { signal }).then((r) => r.data),

  // ---- events
  events: (query: { status?: string; event_type?: string; q?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: EventRow[]; types: { key: string; label: string }[]; pagination: Pagination }>('GET', 'events', { query: query as Query, signal }).then((r) => r.data),
  event: (id: number | string, signal?: AbortSignal) => request<EventDetail>('GET', `events/${id}`, { signal }).then((r) => r.data),
  saveEvent: (body: Record<string, unknown>, id?: number) => request<EventRow>('POST', id ? `events/${id}/update` : 'events/store', { body }),
  eventAction: (id: number, action: 'publish' | 'complete' | 'cancel', body: Record<string, unknown> = {}) => request<EventRow>('POST', `events/${id}/${action}`, { body }),
  inviteToEvent: (id: number, channels: string[]) => request<Campaign>('POST', `events/${id}/invite`, { body: { channels } }),
  eventRegistrations: (id: number, signal?: AbortSignal) => request<EventRegistration[]>('GET', `events/${id}/registrations`, { signal }).then((r) => r.data),
  registerForEvent: (id: number, body: { alumni_id: number; participants?: number; guest_details?: string; payment_status?: string }) =>
    request<EventRegistration>('POST', `events/${id}/registrations/store`, { body }),
  registrationAction: (eventId: number, regId: number, action: 'confirm' | 'cancel' | 'payment', body: Record<string, unknown> = {}) =>
    request<Record<string, unknown>>('POST', `events/${eventId}/registrations/${regId}/${action}`, { body }),
  checkIn: (id: number, body: { method: string; value?: string; registration_id?: number }) =>
    request<{ registration: EventRegistration; alumnus: { id: number; full_name: string; alumni_code: string } | null; already_checked_in: boolean }>('POST', `events/${id}/attendance`, { body }),
  eventFeedback: (id: number, body: { alumni_id: number; rating: number; comments?: string }) => request<Record<string, unknown>>('POST', `events/${id}/feedback`, { body }),
  eventReport: (id: number, signal?: AbortSignal) => request<EventReport>('GET', `events/${id}/report`, { signal }).then((r) => r.data),
  uploadEventFile: (id: number, file: File) => {
    const form = new FormData();
    form.set('file', file);
    return requestForm<Record<string, unknown>>(`events/${id}/files/upload`, form);
  },
  downloadEventFile: (id: number, fileId: number) => downloadBinary(`events/${id}/files/${fileId}/download`, {}),
  deleteEventFile: (id: number, fileId: number) => request<null>('POST', `events/${id}/files/${fileId}/delete`, { body: {} }),
  alumnusEvents: (id: number | string, signal?: AbortSignal) => request<AlumnusEvent[]>('GET', `${id}/events`, { signal }).then((r) => r.data),

  // ---- donations (offline-recorded; no gateway)
  donations: (query: { status?: string; campaign_id?: number; alumni_id?: number; q?: string; from?: string; to?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: DonationRow[]; modes: { key: string; label: string }[]; pagination: Pagination }>('GET', 'donations', { query: query as Query, signal }).then((r) => r.data),
  donation: (id: number, signal?: AbortSignal) => request<DonationDetail>('GET', `donations/${id}`, { signal }).then((r) => r.data),
  recordDonation: (body: Record<string, unknown>) => request<DonationRow>('POST', 'donations/store', { body }),
  updateDonation: (id: number, body: Record<string, unknown>) => request<DonationRow>('POST', `donations/${id}/update`, { body }),
  donationAction: (id: number, action: 'received' | 'verify' | 'reject' | 'cancel' | 'refund', body: Record<string, unknown> = {}) =>
    request<DonationRow>('POST', `donations/${id}/${action}`, { body }),
  donationReceipt: (id: number, signal?: AbortSignal) => request<DonationReceipt>('GET', `donations/${id}/receipt`, { signal }).then((r) => r.data),
  donationSummary: (query: { campaign_id?: number; from?: string; to?: string }, signal?: AbortSignal) =>
    request<DonationSummary>('GET', 'donations/summary', { query: query as Query, signal }).then((r) => r.data),
  searchDonors: (q: string, signal?: AbortSignal) =>
    request<{ id: number; full_name: string; alumni_code: string; batch: string | null }[]>('GET', 'donations/donors', { query: { q }, signal }).then((r) => r.data),
  donationCampaigns: (signal?: AbortSignal) => request<DonationCampaign[]>('GET', 'donations/campaigns', { signal }).then((r) => r.data),
  saveDonationCampaign: (body: Record<string, unknown>, id?: number) => request<DonationCampaign>('POST', id ? `donations/campaigns/${id}/update` : 'donations/campaigns/store', { body }),
  alumnusDonations: (id: number | string, signal?: AbortSignal) =>
    request<{ id: number; amount: string; status: string; receipt_no: string | null; received_on: string | null; pledged_on: string | null; refunded_amount: string; campaign_name: string | null }[]>('GET', `${id}/donations`, { signal }).then((r) => r.data),

  // ---- reports, import, audit
  reports: (signal?: AbortSignal) => request<ReportInfo[]>('GET', 'reports', { signal }).then((r) => r.data),
  report: (key: string, query: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    request<ReportResult>('GET', `reports/${key}`, { query: query as Query, signal }).then((r) => r.data),
  exportReport: (key: string, filters: Record<string, string | number | undefined>, format: 'csv' | 'xlsx') => downloadBinary(`reports/${key}/export`, { ...filters, format }),
  importMeta: (signal?: AbortSignal) => request<ImportMeta>('GET', 'import/meta', { signal }).then((r) => r.data),
  importHistory: (signal?: AbortSignal) => request<ImportBatch[]>('GET', 'import', { signal }).then((r) => r.data),
  uploadImport: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return requestForm<ImportUpload>('import/upload', form);
  },
  previewImport: (id: number, mapping: Record<string, number>) => request<ImportBatch>('POST', `import/${id}/preview`, { body: { mapping } }),
  importRows: (id: number, query: { status?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: ImportRow[]; pagination: Pagination }>('GET', `import/${id}/rows`, { query: query as Query, signal }).then((r) => r.data),
  confirmImport: (id: number) => request<ImportBatch>('POST', `import/${id}/confirm`, { body: {} }),
  cancelImport: (id: number) => request<ImportBatch>('POST', `import/${id}/cancel`, { body: {} }),
  downloadImportProblems: (id: number) => downloadBinary(`import/${id}/problems`, {}),
  downloadImportTemplate: () => downloadBinary('import/template', {}),
  audit: (query: { component?: string; action?: string; q?: string; from?: string; to?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: AuditRow[]; components: string[]; actions: string[]; pagination: Pagination }>('GET', 'audit', { query: query as Query, signal }).then((r) => r.data),
  auditEntry: (id: number, signal?: AbortSignal) => request<AuditDetail>('GET', `audit/${id}`, { signal }).then((r) => r.data),

  // ---- portal access (alumni sign-in, staff side)
  alumnusAccount: (id: number | string, signal?: AbortSignal) => request<PortalAccount | null>('GET', `${id}/account`, { signal }).then((r) => r.data),
  inviteAlumnus: (id: number) => request<PortalInvite>('POST', `${id}/invite`, { body: {} }),
  accountAction: (accountId: number, action: 'disable' | 'enable' | 'revoke-sessions' | 'resend-verification', body: Record<string, unknown> = {}) =>
    request<PortalAccount | { signed_out: number } | null>('POST', `accounts/${accountId}/${action}`, { body }),

  // ---- surveys
  surveys: (query: { status?: string; survey_type?: string; q?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: SurveyRow[]; types: { key: string; label: string }[]; pagination: Pagination }>('GET', 'surveys', { query: query as Query, signal }).then((r) => r.data),
  survey: (id: number | string, signal?: AbortSignal) => request<SurveyDetail>('GET', `surveys/${id}`, { signal }).then((r) => r.data),
  saveSurvey: (body: Record<string, unknown>, id?: number) => request<SurveyRow>('POST', id ? `surveys/${id}/update` : 'surveys/store', { body }),
  surveyAction: (id: number, action: 'publish' | 'close' | 'delete') => request<SurveyRow | null>('POST', `surveys/${id}/${action}`, { body: {} }),
  sendSurvey: (id: number, channels: string[]) => request<Campaign>('POST', `surveys/${id}/send`, { body: { channels } }),
  surveyResults: (id: number | string, signal?: AbortSignal) => request<SurveyResults>('GET', `surveys/${id}/results`, { signal }).then((r) => r.data),
  surveyParticipation: (id: number | string, signal?: AbortSignal) =>
    request<{ responded: number; pending: number; pending_alumni: { id: number; full_name: string; alumni_code: string; batch: string | null }[] }>('GET', `surveys/${id}/participation`, { signal }).then((r) => r.data),
  recordSurveyResponse: (id: number, alumniId: number, answers: Record<string, unknown>) =>
    request<{ submission_id: number }>('POST', `surveys/${id}/respond`, { body: { alumni_id: alumniId, answers } }),

  // ---- student-facing
  studentOpportunities: (query: { type?: string; q?: string; page?: number }, signal?: AbortSignal) =>
    request<{ rows: BoardRow[]; types: string[]; pagination: Pagination }>('GET', 'student/opportunities', { query: { opportunity_type: query.type, q: query.q, page: query.page }, signal }).then((r) => r.data),
  studentMentors: (signal?: AbortSignal) => request<StudentMentor[]>('GET', 'student/mentorship/mentors', { signal }).then((r) => r.data),
  studentRequests: (signal?: AbortSignal) => request<StudentRequest[]>('GET', 'student/mentorship/requests', { signal }).then((r) => r.data),
  studentCreateRequest: (body: Record<string, unknown>) => request<Record<string, unknown>>('POST', 'student/mentorship/requests/store', { body }),
  studentCancelRequest: (id: number) => request<Record<string, unknown>>('POST', `student/mentorship/requests/${id}/cancel`, { body: {} }),
  studentSessionFeedback: (sid: number, rating: number, comments?: string) =>
    request<Record<string, unknown>>('POST', `student/mentorship/sessions/${sid}/feedback`, { body: { rating, comments } }),
};

/**
 * `type` is NOT a usable request field on this API: the `api.session` middleware sets type=API on every request and
 * silently replaces any field of that name. The kind of opportunity / engagement therefore travels under its own name.
 */
function renameType<T extends Record<string, unknown>>(body: T, to: string): Record<string, unknown> {
  const { type, ...rest } = body as Record<string, unknown>;
  return type === undefined ? rest : { ...rest, [to]: type };
}

/** Server errors arrive under the renamed field; forms still read them under `type`. */
function withTypeErrors(errors: Record<string, string[]>): Record<string, string[]> {
  const out = { ...errors };
  for (const key of ['opportunity_type', 'engagement_type']) if (out[key] && !out.type) out.type = out[key];
  return out;
}

function stripPaging(filters: ListFilters): Record<string, unknown> {
  const { page: _page, per_page: _perPage, sort: _sort, dir: _dir, ...rest } = filters;
  void _page; void _perPage; void _sort; void _dir;
  return rest;
}

/**
 * Multipart upload through the binary-safe relay. The browser sets the multipart boundary, so no
 * Content-Type header is added here.
 */
async function requestForm<T>(path: string, form: FormData): Promise<{ data: T; message: string }> {
  const session = getFeesSession();
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let response: Response;
  try {
    response = await fetch(`/api/proxy-file?path=${encodeURIComponent(`api/alumni/${path}`)}`, { method: 'POST', headers, body: form, credentials: 'include' });
  } catch {
    throw new AlumniApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? asRecord(JSON.parse(text)) : {};
  } catch {
    throw new AlumniApiError(response.status === 413 ? 'The file is too large.' : "Couldn't read the response. Try again.", response.status);
  }
  if (!response.ok || Number(payload.status_code ?? payload.status) !== 1) {
    throw new AlumniApiError(readString(payload.message) || "Couldn't upload the file. Try again.", response.status, asRecord(payload.errors) as Record<string, string[]>);
  }
  return { data: payload.data as T, message: readString(payload.message) };
}

/**
 * POST to a file endpoint (document download, export) and hand the bytes to the browser as a download.
 * The session token travels in the Authorization header, so there is no URL a bystander could reuse.
 */
async function downloadBinary(path: string, body: Record<string, unknown>): Promise<string> {
  const session = getFeesSession();
  const headers: Record<string, string> = { Accept: '*/*', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let response: Response;
  try {
    response = await fetch(`/api/proxy-file?path=${encodeURIComponent(`api/alumni/${path}`)}`, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
  } catch {
    throw new AlumniApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    let message = '';
    try {
      message = readString(asRecord(await response.json()).message);
    } catch {
      /* not JSON */
    }
    throw new AlumniApiError(message || (response.status === 403 ? "You don't have access to alumni management." : "Couldn't download the file. Try again."), response.status);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : 'alumni-download';
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

export type DirectoryOptions = {
  batches: string[]; passing_years: (string | number)[]; courses: string[]; countries: string[]; cities: string[]; industries: string[];
};

export type BatchGroup = 'batch' | 'passing_year' | 'admission_year' | 'course' | 'department' | 'campus';

export type BatchStats = {
  group_by: BatchGroup;
  home_country: string;
  rows: BatchRow[];
  totals: Omit<BatchRow, 'batch_key'>;
};

export type BatchRow = {
  batch_key: string | number; total: number; male: number; female: number; registered: number; pending_verification: number;
  verified: number; active: number; employed: number; entrepreneurs: number; job_seeking: number; abroad: number; higher_education: number;
};

export type DirectoryFilters = {
  q?: string; batch?: string; passing_year?: string; course?: string; department?: string; campus?: string;
  city?: string; state?: string; country?: string; company?: string; industry?: string; job_role?: string;
  skill?: string; higher_education?: string; student_id?: string; gr_no?: string; enrollment_no?: string;
  sort?: string; dir?: 'asc' | 'desc'; page?: number; per_page?: number;
};

export type DirectoryRow = {
  id: number; alumni_code: string; full_name: string; batch: string | null; passing_year: number | null; course: string | null;
  last_class: string | null; city: string | null; state: string | null; country: string | null; current_company: string | null;
  current_job_title: string | null; current_industry: string | null; employment_status: string | null; linkedin_url: string | null;
  email: string | null; mobile: string | null; skills: { skill: string; level: string }[];
  education: { qualification: string; course: string | null; institution: string | null; country: string | null }[];
  hidden: string[];
};

export type PrivacyPayload = {
  fields: { key: string; label: string; level: string; is_default: boolean }[];
  levels: string[];
  consents: { consent_email: boolean; consent_sms: boolean; consent_whatsapp: boolean; consent_push: boolean };
};

export type AlumniDocument = {
  id: number; doc_type: string; original_name: string; mime: string | null; size_bytes: number;
  verification_status: string; verified_by: number | null; verified_at: string | null; remarks: string | null; created_at: string;
};

export type ChildKind = 'education' | 'career' | 'business' | 'skills' | 'achievements';

export type AlumniMeta = {
  statuses: AlumniStatus[]; batches: string[]; passing_years: (string | number)[]; countries: string[];
  states: string[]; cities: string[]; industries: string[]; employment_statuses: string[];
  skill_levels: string[]; eligibility_rules: string[];
};

export type CountRow = { label: string; total: number };

export type AlumniDashboard = {
  totals: {
    total: number; new_last_30_days: number; verified: number; active: number; pending_verification: number;
    average_profile_completion: number; employed: number; entrepreneurs: number; job_seeking: number;
    with_higher_education: number; with_career_data: number;
  };
  by_status: Record<string, number>;
  by_batch: CountRow[]; by_passing_year: CountRow[]; by_country: CountRow[]; by_state: CountRow[];
  by_city: CountRow[]; by_industry: CountRow[]; by_company: CountRow[];
  engagement: { average_score: number | null; active_mentors: number | null; open_mentorship_requests: number | null; published_opportunities: number | null; pending_opportunities: number | null; guest_speakers: number | null };
  recent_registrations: { id: number; alumni_code: string; full_name: string; batch: string | null; status: string; source: string; created_at: string }[];
  pending_approvals: { id: number; alumni_code: string; full_name: string; batch: string | null; created_at: string }[];
};

export type AcademicRow = { syear: string; class_name: string | null; division: string | null; start_date: string | null; end_date: string | null; enrollment_code: string | null };

export type AlumniProfile = {
  alumni: AlumniDetail;
  completion: { percent: number; sections: { key: string; done: boolean; weight: number }[] };
  children: Record<ChildKind, Record<string, string | number | null>[]>;
  documents: { id: number; doc_type: string; original_name: string; verification_status: string; created_at: string }[];
  privacy: Record<string, string>;
  timeline: { id: number; activity_type: string; title: string; detail: string | null; points: number; occurred_at: string }[];
};

export type ConversionPreview = {
  rule: string; total: number;
  candidates: { student_id: number; first_name: string; last_name?: string; enrollment_no?: string; email?: string; mobile?: string; leaving_date?: string }[];
};

export type AlumniSettings = {
  id_pattern: string; eligibility_rule: string; completion_weights: Record<string, number>;
};

// ---------------------------------------------------------------- Phase C types

export type EngagementOverview = {
  types: { key: string; label: string; points: number }[];
  window_months: number;
  levels: { highly_active: number; active: number; occasional: number };
  summary: { engaged_alumni: number; activities: number; guest_speakers: number; active_mentors: number; by_type: Record<string, number> };
};
export type LeaderboardRow = { alumni_id: number; full_name: string; alumni_code: string; batch: string | null; score: number; level: string; level_label: string };
export type ActivityRow = { id: number; alumni_id: number; activity_type: string; title: string; detail: string | null; points: number; ref_type: string | null; occurred_at: string; full_name: string; alumni_code: string };
export type AlumnusEngagement = { score: number; level: string; level_label: string; window_months: number; recent: { id: number; activity_type: string; title: string; points: number; ref_type: string | null; occurred_at: string }[] };

export type MentorRow = {
  id: number; alumni_id: number; full_name: string; alumni_code: string; batch: string | null; alumni_status: string; expertise: string | null; industry: string | null;
  job_role: string | null; preferred_topics: string | null; available_days: string | null; mode: string; experience_years: number | null; capacity: number; status: string; load: number;
};
export type StudentHit = { id: number; first_name: string; last_name: string | null; enrollment_no: string | null };
export type MentorshipRequestRow = {
  id: number; student_id: number; career_area: string; status: string; preferred_date: string | null; mentor_alumni_id: number | null; created_at: string;
  created_by_role: string; student_first: string | null; student_last: string | null; mentor_name: string | null;
};
export type MentorMatch = {
  alumni_id: number; full_name: string; alumni_code: string; batch: string | null; expertise: string | null; industry: string | null; job_role: string | null;
  mode: string; available_days: string | null; open_slots: number; score: number; preferred_by_student: boolean; matched_on: string[];
};
export type MentorshipSession = {
  id: number; scheduled_at: string; duration_minutes: number; mode: string; location: string | null; status: string; notes: string | null;
  feedback: { id: number; from_role: string; rating: number; comments: string | null }[];
};
export type MentorshipDetail = {
  request: { id: number; student_id: number; career_area: string; guidance_needed: string | null; preferred_date: string | null; status: string; mentor_alumni_id: number | null; response_note: string | null; created_by_role: string };
  student: { id: number; first_name: string; last_name: string | null; enrollment_no: string | null } | null;
  mentor: { id: number; full_name: string; alumni_code: string; current_company: string | null } | null;
  sessions: MentorshipSession[];
};

export type OpportunityRow = {
  id: number; alumni_id: number | null; alumni_name: string | null; type: string; company: string; title: string; location: string | null; experience: string | null;
  qualification: string | null; skills: string | null; salary: string | null; last_date: string | null; application_url: string | null; contact_person: string | null;
  description: string | null; status: string; effective_status: string; review_remarks: string | null; created_at: string;
};
export type BoardRow = {
  id: number; type: string; company: string; title: string; location: string | null; experience: string | null; qualification: string | null; skills: string | null;
  salary: string | null; last_date: string | null; application_url: string | null; contact_person: string | null; description: string | null; shared_by: string | null; shared_by_batch: string | null;
};
export type StudentMentor = { alumni_id: number; full_name: string; batch: string | null; expertise: string | null; industry: string | null; job_role: string | null; preferred_topics: string | null; available_days: string | null; mode: string; experience_years: number | null; open_slots: number };
export type StudentRequest = {
  id: number; career_area: string; guidance_needed: string | null; preferred_date: string | null; status: string; created_at: string; mentor_name: string | null;
  sessions: { id: number; scheduled_at: string; duration_minutes: number; mode: string; location: string | null; status: string; my_rating: number | null }[];
};

// ---------------------------------------------------------------- Phase D types

export type CommMeta = {
  types: { key: string; label: string }[];
  channels: { key: string; state: 'live' | 'file_only' | 'not_configured' | 'driver_missing' | 'off'; note: string }[];
  placeholders: string[];
};
export type MessageTemplate = { id: number; name: string; comm_type: string; subject: string; body: string; is_system: number };
export type AudiencePreview = { matched: number; channels: Record<string, { reachable: number; no_consent: number }>; audience_label: string };
export type Campaign = {
  id: number; name: string; comm_type: string; subject: string; body?: string; channels: string; audience_label: string | null; status: string; scheduled_at: string | null;
  recipient_count: number; sent_count: number; skipped_count: number; failed_count: number; no_consent_count: number; created_at: string; finished_at: string | null; last_error?: string | null;
};
export type CampaignDetail = {
  campaign: Campaign;
  breakdown: { channel: string; status: string; total: number }[];
  reasons: { channel: string; reason: string; total: number }[];
  channel_status: Record<string, { state: string; note: string }>;
};
export type HistoryRow = {
  id: number; alumni_id: number; full_name: string; alumni_code: string; campaign_id: number | null; campaign_name: string | null; recipient_group: string | null;
  comm_type: string; channel: string; subject: string | null; status: string; reason: string | null; read_at: string | null; response: string | null; is_transactional: number; created_at: string;
};

export type EventRow = {
  id: number; name: string; description: string | null; event_type: string; event_date: string; start_time: string | null; end_time: string | null; venue: string | null; mode: string;
  online_link: string | null; capacity: number | null; registration_required: number; auto_confirm: number; registration_deadline: string | null; organizer: string | null;
  contact_person: string | null; contact_phone: string | null; contact_email: string | null; fee_amount: string | number; status: string; audience_label: string | null; seats_used: number;
};
export type EventDetail = { event: EventRow; audience: Record<string, string>; files: { id: number; original_name: string; mime: string | null; size_bytes: number; created_at: string }[] };
export type EventRegistration = {
  id: number; alumni_id: number; full_name: string; alumni_code: string; batch: string | null; registration_no: string; participants: number; guest_details: string | null;
  payment_status: string; status: string; qr_token: string; registered_at: string | null; attended_at: string | null; attendance_method: string | null;
};
export type EventReport = {
  event: EventRow; registered: number; confirmed: number; waitlisted: number; cancelled: number; attended: number; no_show: number; absent: number | null;
  participants_attended: number; seats_used: number; capacity: number | null; feedback_count: number; feedback_average: number | null;
  feedback: { full_name: string; alumni_code: string; rating: number; comments: string | null; created_at: string }[];
};
export type AlumnusEvent = { event_id: number; name: string; event_type: string; event_date: string; registration_no: string; status: string; participants: number; attended_at: string | null };

export type SurveyRow = {
  id: number; title: string; survey_type: string; description: string | null; status: string; anonymous: number; opens_at: string | null; closes_at: string | null;
  audience_label: string | null; response_count: number; question_count: number; is_open: boolean; created_at: string;
};
export type SurveyQuestion = { id?: number; question_type: string; prompt: string; options: string[]; required: boolean | number; scale_min: number | null; scale_max: number | null };
export type SurveyDetail = { survey: SurveyRow; audience: Record<string, string>; questions: SurveyQuestion[]; response_count: number; locked: boolean };
export type SurveyResults = {
  survey: SurveyRow; responses: number; audience: number; response_rate: number | null;
  questions: {
    id: number; prompt: string; question_type: string; required: boolean; answered: number;
    counts?: { option: string; count: number; percent: number }[]; average?: number | null; min?: number | null; max?: number | null;
    distribution?: { rating: number; count: number }[]; texts?: { answer: string; by: string | null }[];
  }[];
};

export type DonationRow = {
  id: number; alumni_id: number; campaign_id: number | null; amount: string | number; currency: string; purpose: string | null; payment_mode: string | null; reference_no: string | null;
  pledged_on: string | null; received_on: string | null; status: string; anonymous: number; notes: string | null; decision_note: string | null; receipt_no: string | null;
  receipt_issued_at: string | null; refunded_amount: string | number; full_name?: string; alumni_code?: string; campaign_name?: string | null; verified_by?: number | null; recorded_by?: number | null;
};
export type DonationDetail = { donation: DonationRow; alumnus: { id: number; full_name: string; alumni_code: string } | null; refunds: { id: number; amount: string; reason: string; refunded_on: string; payment_mode: string | null; reference_no: string | null }[] };
export type DonationReceipt = {
  receipt_no: string; issued_at: string; institute: string; donor: { name: string; alumni_code: string; email: string | null } | null; amount: number; currency: string; payment_mode: string | null;
  reference_no: string | null; received_on: string | null; purpose: string | null; campaign: string | null; refunded_amount: number; status: string; kind: string;
};
export type DonationCampaign = { id: number; name: string; purpose: string | null; description: string | null; goal_amount: string | null; starts_on: string | null; ends_on: string | null; status: string; raised: number; percent: number | null };
export type DonationSummary = {
  raised: number; gross_verified: number; refunded: number; verified_count: number; pending_amount: number; pending_count: number; pledged_amount: number; pledged_count: number; donors: number;
  by_campaign: { campaign_id: number | null; name: string; donations: number; net: number }[]; by_month: { month: string; donations: number; net: number }[];
  top_donors: { alumni_id: number | null; name: string; alumni_code: string | null; donations: number; net: number }[];
};

export type ReportInfo = { key: string; label: string; description: string; filters: string[] };
export type ReportResult = {
  key: string; label: string; columns: { key: string; label: string }[]; rows: Record<string, string | number | null>[]; summary: { label: string; value: string | number }[];
  generated_at: string; pagination: Pagination;
};
export type ImportMeta = { fields: { key: string; label: string; required: boolean }[]; max_rows: number; max_mb: number; formats: string[] };
export type ImportBatch = {
  id: number; original_name: string; status: string; total_rows: number; valid_count: number; error_count: number; duplicate_count: number; imported_count: number;
  skipped_count: number; failed_count: number; created_at: string; confirmed_at: string | null; remaining?: number;
};
export type ImportUpload = { batch: ImportBatch; headers: string[]; sample: string[][]; suggested: Record<string, number>; previously_imported_at: string | null };
export type ImportRow = {
  row_no: number; status: string; errors: Record<string, string[]>; note: string | null; duplicate_of: number | null; alumni_id: number | null;
  name: string | null; email: string | null; mobile: string | null; batch: string | null;
};
export type AuditRow = { id: number; created_at: string; actor_user_id: number | null; actor_name: string | null; component: string | null; action: string; entity_type: string | null; entity_id: string | null };
export type AuditDetail = AuditRow & { ip: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null };

export type PortalAccount = {
  id: number; alumni_id: number; email: string; status: 'invited' | 'unverified' | 'active' | 'disabled'; email_verified: boolean; created_via: string;
  last_login_at: string | null; locked: boolean; disabled_reason: string | null; created_at: string;
};
export type PortalInvite = { link: string; email_status: string; email: string; expires_in_days: number };
