import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

export type ProctoringEventType =
  | 'tab_hidden'
  | 'tab_visible'
  | 'window_blur'
  | 'window_focus'
  | 'fullscreen_exit'
  | 'fullscreen_enter'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'context_menu'
  | 'page_refresh'
  | 'network_disconnect'
  | 'network_reconnect'
  | 'inactivity_warning'
  | 'auto_submit'
  | 'screenshot_attempt'
  | 'select_all';

export type ProctoringSessionStatus = 'active' | 'submitted' | 'interrupted';

export interface ProctoringSessionSummary {
  sessionId: string;
  studentId: string;
  examId: string;
  examName: string;
  status: ProctoringSessionStatus;
  startedAt: string;
  endedAt: string;
  lastEventAt: string;
  eventCount: number;
  violationCount: number;
  tabSwitchCount: number;
  criticalViolationCount: number;
  autoSubmitReason: string;
}

export interface ProctoringEvent {
  id: string;
  examId: string;
  questionPaperId: string;
  questionPaperName: string;
  studentId: string;
  sessionId: string;
  eventType: ProctoringEventType;
  isViolation: boolean;
  severity: 'info' | 'warning' | 'critical';
  violationCount: number | null;
  occurredAt: string;
  details: Record<string, string>;
}

export interface ProctoringAnswers {
  mcq: Record<string, string[]>;
  narrative: Record<string, string>;
}

export interface ProctoringSettings {
  tabSwitchLimit: number;
  autoSubmitOnTabSwitch: boolean;
  criticalViolationLimit: number;
  inactivitySeconds: number;
  heartbeatSeconds: number;
}

export interface ProctoringStartData {
  sessionId: string;
  status: ProctoringSessionStatus;
  remainingSeconds: number;
  draft: ProctoringAnswers;
  tabSwitchCount: number;
  violationCount: number;
  criticalViolationCount: number;
  settings: ProctoringSettings;
  onlineExamId: string;
  autoSubmitReason: string;
  warningHistory: string[];
}

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function detailsRecord(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== 'string') {
    if (typeof value === 'object' && !Array.isArray(value)) return toRecord(value);
    throw new Error('The proctoring event details were malformed.');
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid event details.');
    }
    return toRecord(parsed);
  } catch {
    throw new Error('The proctoring event details were malformed.');
  }
}

function parseEventType(value: string): ProctoringEventType {
  switch (value) {
    case 'tab_hidden':
    case 'tab_visible':
    case 'window_blur':
    case 'window_focus':
    case 'fullscreen_exit':
    case 'fullscreen_enter':
    case 'copy':
    case 'cut':
    case 'paste':
    case 'context_menu':
    case 'page_refresh':
    case 'network_disconnect':
    case 'network_reconnect':
    case 'inactivity_warning':
    case 'auto_submit':
    case 'screenshot_attempt':
    case 'select_all':
      return value;
    default:
      throw new Error('The server returned an invalid proctoring event type.');
  }
}

async function readJson(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = (await response.text()).trim();
  if (!text) {
    if (!response.ok) throw new Error(fallback);
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return toRecord(parsed);
  } catch {
    throw new Error(fallback);
  }
}

async function request(
  path: string,
  fallback: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const session = requireSession();
  const response = await fetch(`${session.baseUrl}/api/exam-proctoring${path}`, {
    ...init,
    headers: {
      ...createAuthHeaders(session, init?.body ? 'application/json' : undefined),
      ...init?.headers,
    },
  });
  const payload = await readJson(response, fallback);
  if (!response.ok || payload.success !== true) {
    throw new Error(readString(payload.message) || fallback);
  }
  return payload;
}

function mapSession(value: unknown): ProctoringSessionSummary {
  const record = toRecord(value);
  const status = readString(record.status);
  if (status !== 'active' && status !== 'submitted' && status !== 'interrupted') {
    throw new Error('The server returned an invalid proctoring session status.');
  }
  return {
    sessionId: readString(record.session_id),
    studentId: readString(record.student_id),
    examId: readString(record.exam_id),
    examName: readString(record.exam_name) || `Exam #${readString(record.exam_id)}`,
    status,
    startedAt: readString(record.started_at),
    endedAt: readString(record.ended_at),
    lastEventAt: readString(record.last_event_at),
    eventCount: readNumber(record.event_count),
    violationCount: readNumber(record.violation_count),
    tabSwitchCount: readNumber(record.tab_switch_count),
    criticalViolationCount: readNumber(record.critical_violation_count),
    autoSubmitReason: readString(record.auto_submit_reason),
  };
}

function parseAnswers(value: unknown): ProctoringAnswers {
  const record = toRecord(value);
  const mcq = toRecord(record.mcq);
  const narrative = toRecord(record.narrative);
  return {
    mcq: Object.fromEntries(
      Object.entries(mcq).flatMap(([questionId, values]) =>
        Array.isArray(values) && values.every((answer) => typeof answer === 'string')
          ? [[questionId, values]]
          : []
      )
    ),
    narrative: Object.fromEntries(
      Object.entries(narrative).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    ),
  };
}

export async function startProctoringSession(
  examId: string,
  clientSessionKey: string
): Promise<ProctoringStartData> {
  const payload = await request(
    '/sessions',
    "Couldn't start proctoring for this exam.",
    {
      method: 'POST',
      body: JSON.stringify({ exam_id: examId, client_session_key: clientSessionKey }),
    }
  );
  const data = toRecord(payload.data);
  const rawSettings = toRecord(data.settings);
  const sessionId = readString(data.session_id);
  if (!sessionId) throw new Error("Couldn't start proctoring for this exam.");
  const status = readString(data.status);
  if (status !== 'active' && status !== 'submitted' && status !== 'interrupted') {
    throw new Error('The server returned an invalid proctoring session status.');
  }
  return {
    sessionId,
    status,
    remainingSeconds: readNumber(data.remaining_seconds),
    draft: parseAnswers(data.draft),
    tabSwitchCount: readNumber(data.tab_switch_count),
    violationCount: readNumber(data.violation_count),
    criticalViolationCount: readNumber(data.critical_violation_count),
    settings: {
      tabSwitchLimit: Math.max(1, readNumber(rawSettings.tab_switch_limit) || 3),
      autoSubmitOnTabSwitch: rawSettings.auto_submit_on_tab_switch !== false,
      criticalViolationLimit: Math.max(1, readNumber(rawSettings.critical_violation_limit) || 5),
      inactivitySeconds: Math.max(60, readNumber(rawSettings.inactivity_seconds) || 300),
      heartbeatSeconds: Math.max(5, readNumber(rawSettings.heartbeat_seconds) || 15),
    },
    onlineExamId: readString(data.online_exam_id),
    autoSubmitReason: readString(data.auto_submit_reason),
    warningHistory: Array.isArray(data.warning_history)
      ? data.warning_history.flatMap((entry) => {
          const message = readString(toRecord(entry).message);
          return message ? [message] : [];
        })
      : [],
  };
}

export async function recordProctoringEvent(
  sessionId: string,
  clientSessionKey: string,
  eventType: ProctoringEventType,
  details: Record<string, string>,
  eventKey: string,
  occurredAt = new Date().toISOString()
): Promise<Record<string, unknown>> {
  const payload = await request(
    `/sessions/${encodeURIComponent(sessionId)}/events`,
    "Couldn't save a proctoring event.",
    {
      method: 'POST',
      body: JSON.stringify({
        event_type: eventType,
        client_session_key: clientSessionKey,
        event_key: eventKey,
        occurred_at: occurredAt,
        details,
      }),
    }
  );
  return toRecord(payload.data);
}

export async function saveProctoringDraft(
  sessionId: string,
  answers: ProctoringAnswers
): Promise<boolean> {
  const payload = await request(
    `/sessions/${encodeURIComponent(sessionId)}/draft`,
    "Couldn't save your answers for recovery.",
    {
      method: 'PUT',
      body: JSON.stringify({ answers }),
    }
  );
  return toRecord(payload.data).saved !== false;
}

export async function heartbeatProctoringSession(
  sessionId: string
): Promise<{ remainingSeconds: number; expired: boolean; autoSubmitReason: string; onlineExamId: string }> {
  const payload = await request(
    `/sessions/${encodeURIComponent(sessionId)}/heartbeat`,
    "Couldn't synchronize the examination timer."
  );
  const data = toRecord(payload.data);
  return {
    remainingSeconds: readNumber(data.remaining_seconds),
    expired: data.expired === true,
    autoSubmitReason: readString(data.auto_submit_reason),
    onlineExamId: readString(data.online_exam_id),
  };
}

export async function submitProctoringSession(
  sessionId: string,
  answers: ProctoringAnswers
): Promise<{ onlineExamId: string }> {
  const payload = await request(
    `/sessions/${encodeURIComponent(sessionId)}/submit`,
    "Couldn't submit the examination.",
    {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }
  );
  const onlineExamId = readString(toRecord(payload.data).online_exam_id);
  if (!onlineExamId) throw new Error("The server didn't return an examination result.");
  return { onlineExamId };
}

export async function completeProctoringSession(
  sessionId: string,
  status: Extract<ProctoringSessionStatus, 'interrupted'>,
  keepalive = false
): Promise<void> {
  await request(
    `/sessions/${encodeURIComponent(sessionId)}/complete`,
    "Couldn't update the proctoring session.",
    {
      method: 'POST',
      body: JSON.stringify({ status }),
      keepalive,
    }
  );
}

export async function fetchProctoringSessions(
  examId?: string,
  signal?: AbortSignal
): Promise<ProctoringSessionSummary[]> {
  const query = examId ? `?exam_id=${encodeURIComponent(examId)}` : '';
  const payload = await request(
    `/sessions${query}`,
    "Couldn't load examination monitoring records.",
    { signal }
  );
  if (!Array.isArray(payload.data)) {
    throw new Error("The server returned an invalid examination monitoring response.");
  }
  const sessions = payload.data.map(mapSession);
  if (sessions.some((session) => !session.sessionId)) {
    throw new Error('The server returned a proctoring session without an ID.');
  }
  return sessions;
}

export async function fetchProctoringEvents(
  sessionId: string,
  signal?: AbortSignal
): Promise<ProctoringEvent[]> {
  const payload = await request(
    `/sessions/${encodeURIComponent(sessionId)}/events`,
    "Couldn't load the proctoring event timeline.",
    { signal }
  );
  if (!Array.isArray(payload.data)) {
    throw new Error("The server returned an invalid proctoring event timeline.");
  }
  return payload.data.map((value) => {
    const record = toRecord(value);
    const details = detailsRecord(record.event_details ?? record.details);
    return {
      id: readString(record.id),
      examId: readString(record.exam_id),
      questionPaperId: readString(record.question_paper_id),
      questionPaperName: readString(record.question_paper_name),
      studentId: readString(record.student_id),
      sessionId: readString(record.session_id),
      eventType: parseEventType(readString(record.event_type)),
      isViolation: readNumber(record.is_violation) === 1,
      severity: record.severity === 'critical' || record.severity === 'warning' ? record.severity : 'info',
      violationCount: record.violation_count == null ? null : readNumber(record.violation_count),
      occurredAt: readString(record.created_at) || readString(record.occurred_at),
      details: Object.fromEntries(
        Object.entries(details).map(([key, detail]) => [key, readString(detail)])
      ),
    };
  });
}
