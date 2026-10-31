'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  completeProctoringSession as completeSessionRequest,
  heartbeatProctoringSession,
  recordProctoringEvent,
  saveProctoringDraft,
  startProctoringSession,
  type ProctoringAnswers,
  type ProctoringEventType,
  type ProctoringSessionStatus,
  type ProctoringSettings,
} from '@/app/exam/data/proctoring';

interface PendingEvent {
  eventKey: string;
  eventType: ProctoringEventType;
  details: Record<string, string>;
  occurredAt: string;
}

const EMPTY_ANSWERS: ProctoringAnswers = { mcq: {}, narrative: {} };

function parseStoredAnswers(value: unknown): ProctoringAnswers | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rawMcq = record.mcq;
  const rawNarrative = record.narrative;
  if (!rawMcq || typeof rawMcq !== 'object' || Array.isArray(rawMcq)) return null;
  if (!rawNarrative || typeof rawNarrative !== 'object' || Array.isArray(rawNarrative)) return null;
  const mcq = Object.entries(rawMcq).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((answer) => typeof answer === 'string')
  );
  const narrative = Object.entries(rawNarrative).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );
  return {
    mcq: Object.fromEntries(mcq),
    narrative: Object.fromEntries(narrative),
  };
}

function createClientSessionKey(): string {
  if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function storageKey(examId: string, suffix: string): string {
  return `exam-proctoring-${examId}-${suffix}`;
}

function isProctoringEventType(value: string): value is ProctoringEventType {
  return [
    'tab_hidden',
    'tab_visible',
    'window_blur',
    'window_focus',
    'fullscreen_exit',
    'fullscreen_enter',
    'copy',
    'cut',
    'paste',
    'context_menu',
    'page_refresh',
    'network_disconnect',
    'network_reconnect',
    'inactivity_warning',
    'auto_submit',
    'screenshot_attempt',
    'select_all',
  ].includes(value);
}

function readPendingEvents(examId: string): PendingEvent[] {
  try {
    const raw = sessionStorage.getItem(storageKey(examId, 'pending-events'));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): PendingEvent[] => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
      const event = entry as Record<string, unknown>;
      if (
        typeof event.eventType !== 'string'
        || !isProctoringEventType(event.eventType)
        || typeof event.occurredAt !== 'string'
        || !event.details
        || typeof event.details !== 'object'
        || Array.isArray(event.details)
      ) {
        return [];
      }
      const details = Object.fromEntries(
        Object.entries(event.details).filter((detail): detail is [string, string] => typeof detail[1] === 'string')
      );
      return [{
        eventKey: typeof event.eventKey === 'string' ? event.eventKey : createClientSessionKey(),
        eventType: event.eventType,
        details,
        occurredAt: event.occurredAt,
      }];
    });
  } catch {
    return [];
  }
}

function persistPendingEvents(examId: string, events: PendingEvent[]): boolean {
  try {
    sessionStorage.setItem(storageKey(examId, 'pending-events'), JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

function acknowledgePendingEvent(examId: string, eventKey: string): void {
  persistPendingEvents(
    examId,
    readPendingEvents(examId).filter((event) => event.eventKey !== eventKey)
  );
}

export function useExamProctoring(examId: string, enabled: boolean) {
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [warningHistory, setWarningHistory] = useState<string[]>([]);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [restrictionsActive, setRestrictionsActive] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [serverRemainingSeconds, setServerRemainingSeconds] = useState<number | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [criticalViolationCount, setCriticalViolationCount] = useState(0);
  const [settings, setSettings] = useState<ProctoringSettings | null>(null);
  const [restoredAnswers, setRestoredAnswers] = useState<ProctoringAnswers>(EMPTY_ANSWERS);
  const [autoSubmitReason, setAutoSubmitReason] = useState('');
  const [existingOnlineExamId, setExistingOnlineExamId] = useState('');

  const sessionIdRef = useRef('');
  const startPromiseRef = useRef<ReturnType<typeof startProctoringSession> | null>(null);
  const clientSessionKeyRef = useRef('');
  const eventQueueRef = useRef<Promise<void>>(Promise.resolve());
  const hasEnteredFullscreenRef = useRef(false);
  const eventFailureRef = useRef(false);
  const submittedRef = useRef(false);
  const recoveryPendingRef = useRef(false);
  const refreshEventSentRef = useRef(false);
  const latestAnswersRef = useRef<ProctoringAnswers>(EMPTY_ANSWERS);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const ensureSession = useCallback(async () => {
    if (!examId || !enabled) return null;
    if (sessionIdRef.current) return sessionIdRef.current;
    if (!clientSessionKeyRef.current) {
      const key = storageKey(examId, 'client-key');
      try {
        clientSessionKeyRef.current = sessionStorage.getItem(key) || createClientSessionKey();
        sessionStorage.setItem(key, clientSessionKeyRef.current);
        recoveryPendingRef.current = sessionStorage.getItem(storageKey(examId, 'started')) === 'true';
      } catch {
        clientSessionKeyRef.current = createClientSessionKey();
      }
    }
    if (!startPromiseRef.current) {
      startPromiseRef.current = startProctoringSession(examId, clientSessionKeyRef.current);
    }

    try {
      const started = await startPromiseRef.current;
      sessionIdRef.current = started.sessionId;
      setSessionId(started.sessionId);
      setRestrictionsActive(started.status === 'active');
      setServerRemainingSeconds(started.remainingSeconds);
      setTabSwitchCount(started.tabSwitchCount);
      setViolationCount(started.violationCount);
      setCriticalViolationCount(started.criticalViolationCount);
      setSettings(started.settings);
      setAutoSubmitReason(started.autoSubmitReason);
      setExistingOnlineExamId(started.onlineExamId);
      setWarningHistory(started.warningHistory);
      setWarning(started.warningHistory[0] ?? '');
      setError('');
      let answers = started.draft;
      if (!Object.values(answers.mcq).some((values) => values.length) && !Object.values(answers.narrative).some(Boolean)) {
        try {
          const local = localStorage.getItem(storageKey(examId, 'answers'));
          if (local) answers = parseStoredAnswers(JSON.parse(local)) ?? answers;
        } catch {
          setError("Couldn't restore locally saved answers.");
        }
      }
      setRestoredAnswers(answers);
      try {
        sessionStorage.setItem(storageKey(examId, 'started'), 'true');
      } catch {
        setError("Couldn't preserve the recovery marker for this examination.");
      }

      if (started.autoSubmitReason || started.remainingSeconds <= 0) {
        setAutoSubmitReason(started.autoSubmitReason || 'time_expired');
      }
      return started.sessionId;
    } catch (reason) {
      startPromiseRef.current = null;
      const message =
        reason instanceof Error ? reason.message : "Couldn't start proctoring for this exam.";
      setError(message);
      throw reason;
    }
  }, [examId, enabled]);

  const applyEventResponse = useCallback((data: Record<string, unknown>) => {
    const message = typeof data.warning_message === 'string' ? data.warning_message : '';
    const tabLimitExceeded = data.tab_limit_exceeded === true;
    const autoSubmitReason = typeof data.auto_submit_reason === 'string' ? data.auto_submit_reason : '';
    const actualMessage = autoSubmitReason === 'tab_switch'
      ? 'Switching tabs is not allowed. Your examination is being submitted.'
      : tabLimitExceeded
        ? 'You have exceeded the allowed number of tab switches. Further violations may submit the exam.'
        : message;
    if (actualMessage) {
      setWarning(actualMessage);
      setWarningHistory((history) => [actualMessage, ...history].slice(0, 10));
    }
    if (typeof data.tab_switch_count === 'number') setTabSwitchCount(data.tab_switch_count);
    if (typeof data.violation_count === 'number') setViolationCount(data.violation_count);
    if (typeof data.critical_violation_count === 'number') {
      setCriticalViolationCount(data.critical_violation_count);
    }
    if (data.should_auto_submit === true) {
      setAutoSubmitReason(autoSubmitReason || 'critical_violation_threshold');
    }
  }, []);

  const schedulePendingRetry = useCallback(() => {
    if (retryTimerRef.current !== null) return;
    const delay = Math.min(60_000, 3_000 * 2 ** retryAttemptRef.current);
    retryAttemptRef.current += 1;
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setRetryToken((current) => current + 1);
    }, delay);
  }, []);

  const queueEvent = useCallback(
    (eventType: ProctoringEventType, details: Record<string, string> = {}) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return Promise.resolve();

      const pendingEvent: PendingEvent = {
        eventKey: createClientSessionKey(),
        eventType,
        details,
        occurredAt: new Date().toISOString(),
      };
      const pending = eventQueueRef.current.then(async () => {
        const stored = persistPendingEvents(examId, [...readPendingEvents(examId), pendingEvent]);
        if (!stored) {
          eventFailureRef.current = true;
          setError("Couldn't securely queue this proctoring event for retry.");
        }
        if (!navigator.onLine) {
          return;
        }
        try {
          const result = await recordProctoringEvent(
            currentSessionId,
            clientSessionKeyRef.current,
            eventType,
            details,
            pendingEvent.eventKey,
            pendingEvent.occurredAt
          );
          applyEventResponse(result);
          acknowledgePendingEvent(examId, pendingEvent.eventKey);
        } catch (reason) {
          eventFailureRef.current = true;
          schedulePendingRetry();
          if (navigator.onLine) {
            setError(reason instanceof Error ? reason.message : "Couldn't save a proctoring event.");
          }
        }
      });
      eventQueueRef.current = pending;
      return pending;
    },
    [applyEventResponse, examId, schedulePendingRetry]
  );

  const flushPendingEvents = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || !navigator.onLine) return;
    await eventQueueRef.current;
    const pending = readPendingEvents(examId);
    if (!persistPendingEvents(examId, pending)) {
      eventFailureRef.current = true;
      setError("Couldn't securely queue proctoring events for synchronization.");
      return;
    }
    let failed = false;
    for (const event of pending) {
      try {
        const result = await recordProctoringEvent(
          currentSessionId,
          clientSessionKeyRef.current,
          event.eventType,
          event.details,
          event.eventKey,
          event.occurredAt
        );
        applyEventResponse(result);
        acknowledgePendingEvent(examId, event.eventKey);
      } catch (reason) {
        failed = true;
        if (navigator.onLine) {
          setError(reason instanceof Error ? reason.message : "Couldn't synchronize a proctoring event.");
        }
      }
    }
    if (!failed && readPendingEvents(examId).length === 0) {
      eventFailureRef.current = false;
      retryAttemptRef.current = 0;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    } else if (failed) {
      eventFailureRef.current = true;
      schedulePendingRetry();
    }
  }, [applyEventResponse, examId, schedulePendingRetry]);

  useEffect(() => {
    if (!examId || !enabled || sessionId) return;
    void ensureSession().catch(() => undefined);
  }, [examId, enabled, sessionId, retryToken, ensureSession]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (!sessionId || !restrictionsActive || !navigator.onLine) return;
    const timer = window.setTimeout(() => void flushPendingEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [sessionId, restrictionsActive, retryToken, flushPendingEvents]);

  useEffect(() => {
    if (!sessionId || !restrictionsActive) return;
    if (!recoveryPendingRef.current || refreshEventSentRef.current) return;
    refreshEventSentRef.current = true;
    void queueEvent('page_refresh', { source: 'exam_page_reload' });
  }, [examId, restrictionsActive, sessionId, queueEvent]);

  useEffect(() => {
    if (!sessionId || !restrictionsActive) return;
    hasEnteredFullscreenRef.current = Boolean(document.fullscreenElement);
    setFullscreenActive(hasEnteredFullscreenRef.current);

    let inactivityTimer = 0;
    let inactivityLogged = false;
    const resetInactivityTimer = () => {
      window.clearTimeout(inactivityTimer);
      if (inactivityLogged || !settings) return;
      inactivityTimer = window.setTimeout(() => {
        inactivityLogged = true;
        void queueEvent('inactivity_warning', { threshold_seconds: String(settings.inactivitySeconds) });
      }, settings.inactivitySeconds * 1000);
    };
    const onVisibilityChange = () => {
      void queueEvent(
        document.visibilityState === 'hidden' ? 'tab_hidden' : 'tab_visible',
        { visibility_state: document.visibilityState }
      );
    };
    const onWindowBlur = () => void queueEvent('window_blur', { source: 'window' });
    const onWindowFocus = () => void queueEvent('window_focus', { source: 'window' });
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreenActive(active);
      if (active) {
        hasEnteredFullscreenRef.current = true;
        void queueEvent('fullscreen_enter', { active: 'true' });
      } else if (hasEnteredFullscreenRef.current) {
        void queueEvent('fullscreen_exit', { active: 'false' });
      }
    };
    const onClipboardAction = (event: Event) => {
      const eventType = event.type;
      if (eventType !== 'copy' && eventType !== 'cut' && eventType !== 'paste') return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : 'unknown';
      void queueEvent(eventType, { target });
    };
    const onSelectionStart = (event: Event) => {
      if (event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      event.stopPropagation();
      void queueEvent('select_all', { source: 'text_selection' });
    };
    const onDragStart = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void queueEvent('copy', { source: 'drag' });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const target = event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : 'unknown';
      const screenshotShortcut =
        key === 'printscreen'
        || ((event.metaKey || event.ctrlKey) && event.shiftKey && ['s', '3', '4', '5'].includes(key));
      if (screenshotShortcut) {
        event.preventDefault();
        event.stopPropagation();
        void queueEvent('screenshot_attempt', {
          target,
          shortcut: event.key,
          modifiers: [
            event.ctrlKey ? 'ctrl' : '',
            event.metaKey ? 'meta' : '',
            event.altKey ? 'alt' : '',
            event.shiftKey ? 'shift' : '',
          ].filter(Boolean).join('+'),
          limitation: 'browser_cannot_block_os_capture',
        });
        return;
      }
      let action: 'copy' | 'cut' | 'paste' | 'select_all' | null = null;
      if ((event.ctrlKey || event.metaKey) && key === 'c') action = 'copy';
      else if ((event.ctrlKey || event.metaKey) && key === 'a') action = 'select_all';
      else if ((event.ctrlKey || event.metaKey) && key === 'x') action = 'cut';
      else if ((event.ctrlKey || event.metaKey) && key === 'v') action = 'paste';
      else if (event.shiftKey && key === 'insert') action = 'paste';
      else if (event.ctrlKey && key === 'insert') action = 'copy';
      else if (event.shiftKey && key === 'delete') action = 'cut';
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      void queueEvent(action, { target, shortcut: event.key });
    };
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'insertFromPaste' && event.inputType !== 'insertFromDrop') return;
      event.preventDefault();
      event.stopPropagation();
      void queueEvent('paste', { source: event.inputType, target: 'textarea' });
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void queueEvent('paste', { source: 'drop' });
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void queueEvent('context_menu', { source: 'context_menu' });
    };
    const onPageHide = () => {
      if (!submittedRef.current) {
        try {
          sessionStorage.setItem(storageKey(examId, 'started'), 'true');
        } catch {
          setError("Couldn't preserve the recovery marker for this examination.");
        }
      }
    };
    const onOffline = () => void queueEvent('network_disconnect', { source: 'browser' });
    const onOnline = () => {
      void flushPendingEvents()
        .then(async () => {
          const saved = await saveProctoringDraft(sessionId, latestAnswersRef.current);
          if (!saved) setAutoSubmitReason('time_expired');
        })
        .then(() => queueEvent('network_reconnect', { source: 'browser' }))
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : "Couldn't synchronize proctoring events.")
        );
    };
    const onActivity = () => {
      if (inactivityLogged) {
        inactivityLogged = false;
        resetInactivityTimer();
      } else {
        resetInactivityTimer();
      }
    };

    resetInactivityTimer();
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('copy', onClipboardAction, true);
    document.addEventListener('cut', onClipboardAction, true);
    document.addEventListener('paste', onClipboardAction, true);
    document.addEventListener('selectstart', onSelectionStart, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('beforeinput', onBeforeInput, true);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity);

    return () => {
      window.clearTimeout(inactivityTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('copy', onClipboardAction, true);
      document.removeEventListener('cut', onClipboardAction, true);
      document.removeEventListener('paste', onClipboardAction, true);
      document.removeEventListener('selectstart', onSelectionStart, true);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('beforeinput', onBeforeInput, true);
      document.removeEventListener('drop', onDrop, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [sessionId, restrictionsActive, settings, queueEvent, flushPendingEvents, examId]);

  useEffect(() => {
    if (!sessionId || !restrictionsActive || !settings) return;
    const heartbeat = window.setInterval(() => {
      if (!navigator.onLine) return;
      void heartbeatProctoringSession(sessionId)
        .then((result) => {
          setServerRemainingSeconds(result.remainingSeconds);
          if (result.autoSubmitReason || result.expired) {
            setAutoSubmitReason(result.autoSubmitReason || 'time_expired');
          }
          if (result.onlineExamId) {
            submittedRef.current = true;
            setExistingOnlineExamId(result.onlineExamId);
            setRestrictionsActive(false);
          }
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : "Couldn't synchronize the examination timer.");
        });
    }, settings.heartbeatSeconds * 1000);
    return () => window.clearInterval(heartbeat);
  }, [sessionId, restrictionsActive, settings]);

  const persistLocalDraft = useCallback(
    (answers: ProctoringAnswers) => {
      latestAnswersRef.current = answers;
      try {
        localStorage.setItem(storageKey(examId, 'answers'), JSON.stringify(answers));
      } catch {
        setError("Couldn't store a local answer recovery copy.");
      }
    },
    [examId]
  );

  const saveDraft = useCallback(
    async (answers: ProctoringAnswers): Promise<boolean> => {
      persistLocalDraft(answers);
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || !navigator.onLine) return true;
      try {
        const saved = await saveProctoringDraft(currentSessionId, answers);
        if (!saved) setAutoSubmitReason('time_expired');
        return saved;
      } catch (reason) {
        eventFailureRef.current = true;
        setError(reason instanceof Error ? reason.message : "Couldn't save your answers for recovery.");
        throw reason;
      }
    },
    [persistLocalDraft]
  );

  const complete = useCallback(
    async (status: Extract<ProctoringSessionStatus, 'interrupted'>) => {
      setRestrictionsActive(false);
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;
      try {
        await eventQueueRef.current;
        await completeSessionRequest(currentSessionId, status);
        if (eventFailureRef.current) {
          throw new Error('Some proctoring events could not be saved.');
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Couldn't update the proctoring session.");
        throw reason;
      }
    },
    []
  );

  const markSubmitted = useCallback(() => {
    submittedRef.current = true;
    setRestrictionsActive(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setError('Fullscreen mode is not available in this browser.');
      }
    } catch {
      setError('The browser could not change fullscreen mode. Check its permissions and try again.');
    }
  }, []);

  const retry = useCallback(() => {
    setError('');
    setRetryToken((current) => current + 1);
  }, []);

  return {
    sessionId,
    error,
    warning,
    warningHistory,
    fullscreenActive,
    restrictionsActive,
    serverRemainingSeconds,
    tabSwitchCount,
    violationCount,
    criticalViolationCount,
    settings,
    restoredAnswers,
    autoSubmitReason,
    existingOnlineExamId,
    ensureSession,
    persistLocalDraft,
    saveDraft,
    complete,
    markSubmitted,
    toggleFullscreen,
    retry,
  };
}
