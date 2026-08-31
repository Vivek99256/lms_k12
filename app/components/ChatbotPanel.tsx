'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot as BotIcon,
  ChevronLeft,
  Loader2,
  Mic,
  Send,
  Square,
  SquarePen,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

import { useVoiceInteraction } from '@/hooks/use-voice-interaction';
import { useAgentActionHandler } from '@/hooks/use-agent-action-handler';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  beginChatPageSession,
  ensureConversationId,
  readStoredMessages,
  startNewChatSession,
  writeStoredMessages,
} from '@/lib/chatbot-storage';
// AI Workspace: the same panel, with four more things it can do. The conversational
// path below is untouched — these are additional tabs beside it, not a replacement.
// Deep import, not the package root: this module has no dependencies of its own, so a
// client component can use it without pulling the server-side conversation engine in.
import { toActionableFollowUps } from '@shared/conversational-ai-core/followup-suggestions';
import { useAiWorkspace } from '@/hooks/use-ai-workspace';
import { usePageAiContext } from '@/contexts/PageAiContext';
import type { Capability } from '@/lib/intelligence/workspace';
// The governed twelve-stage pipeline. Reached through the adapter below, which renders
// its answer into the shape this panel already speaks, so the transport can change
// without the render changing at the same time.
import { ask } from '@/lib/intelligence/client';
import { toChatShapedReply } from '@/lib/intelligence/ask-adapter';
import type { AnswerAction, TraceStage } from '@/lib/intelligence/types';
import { LifecycleTrace } from '@/components/intelligence/LifecycleTrace';
import { ActionsTab } from './ai-workspace/ActionsTab';
import { AnalyseTab } from './ai-workspace/AnalyseTab';
import { ConnectionsTab } from './ai-workspace/ConnectionsTab';
import { CreateTab } from './ai-workspace/CreateTab';
import { ContextBanner, WorkspaceTabs } from './ai-workspace/WorkspaceChrome';
import { FlowStrip } from './ai-workspace/FlowStrip';

type ChatMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  status?: string;
  conversationType?: string;
  tools?: string[];
  variant?: 'default' | 'error';
  navigation?: {
    route: string;
    query?: Record<string, string | number>;
    label: string;
  };
  module?: string;
  /** Where the assistant thinks the conversation goes next. Rendered as chips. */
  followUps?: string[];
  /**
   * What the answer actually rests on. Only the tools that really ran, with any
   * data they reported they do not hold.
   */
  citations?: Array<{
    tool: string;
    module?: string;
    available: boolean;
    unavailableSignals?: string[];
  }>;
  /**
   * A consequential action waiting on the user. Present only while unanswered —
   * cleared once they confirm or cancel, so an old prompt cannot be clicked twice.
   */
  confirmation?: {
    action: string;
    riskLevel: 'low' | 'medium' | 'high';
    message: string;
  };
  /** The question that produced the confirmation, replayed when they accept. */
  confirmationFor?: string;
  /**
   * Actions the governed pipeline offered — approve, reject, and anything else that
   * needs a person. Each is the next question with the id of the record it applies to
   * pinned, so clicking one and typing the sentence go down the same path and produce
   * the same trace. Distinct from `confirmation`, which authorises a *tool*; these
   * authorise a *decision*, and the backend records it through the approval gate.
   */
  actions?: AnswerAction[];
  /**
   * The twelve lifecycle stages that produced this answer.
   *
   * Carried on the message rather than held as panel state, because it belongs to the
   * turn: scrolling back to an older answer should show the stages that produced *it*,
   * not the stages of whatever was asked most recently.
   */
  lifecycleTrace?: TraceStage[];
};

/**
 * Which backend answers the conversational tab.
 *
 * While this is off the panel uses the model-driven chat route it was built against.
 * While it is on, the same panel is answered by the governed twelve-stage pipeline and
 * every reply carries the ladder that produced it. Both write to the same conversation
 * tables, so it can be turned on and off without stranding a thread.
 */
const USE_LIFECYCLE_PIPELINE = process.env.NEXT_PUBLIC_AI_LIFECYCLE === '1';

const MODULE_HANDOFF_COPY: Record<string, { title: string; description: string }> = {
  admissions: {
    title: 'Admission details are ready',
    description: 'Continue to the Admission Confirmation module to complete the next step.',
  },
  fees: {
    title: 'Fee collection is ready',
    description: 'Open the Fees Collection page with this student already selected.',
  },
  homework: {
    title: 'Homework record is ready',
    description: 'Open the Homework Report with this record already selected.',
  },
  students: {
    title: 'Student record is ready',
    description: 'Open the student module with this record.',
  },
  attendance: {
    title: 'Attendance report is ready',
    description: 'Open the daywise attendance report with these filters applied.',
  },
  teachers: {
    title: 'Teacher record is ready',
    description: 'Open the teacher module with this record.',
  },
  departments: {
    title: 'Department details are ready',
    description: 'Open the department module with this record.',
  },
  subjects: {
    title: 'Subject details are ready',
    description: 'Open the subject module with this record.',
  },
  courses: {
    title: 'Course details are ready',
    description: 'Open the course master with this record.',
  },
  classes: {
    title: 'Class details are ready',
    description: 'Open academic setup with this class selected.',
  },
};

function getHandoffCopy(module?: string) {
  return (
    MODULE_HANDOFF_COPY[(module || '').toLowerCase()] || {
      title: 'The selected record is ready',
      description: 'Continue to the module to complete the next step.',
    }
  );
}

function createMessageId(prefix: 'user' | 'assistant' | 'assistant-error', value: number) {
  return `${prefix}-${value}`;
}

function readMessageCounter(messages: ChatMessage[]) {
  return messages.reduce((maxValue, message) => {
    const match = message.id.match(/-(\d+)$/);
    if (!match) return maxValue;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.max(maxValue, parsed) : maxValue;
  }, 0);
}

function normalizeStoredMessages(messages: ChatMessage[]) {
  const seen = new Set<string>();
  let counter = 0;

  return messages.map((message) => {
    counter += 1;
    const nextId =
      message.id && !seen.has(message.id)
        ? message.id
        : createMessageId(message.role === 'user' ? 'user' : 'assistant', counter);
    seen.add(nextId);
    return {
      ...message,
      id: nextId,
    };
  });
}

/*
 * Conversation id and message persistence now live in lib/chatbot-storage, because
 * the "clear on refresh" rule has to be decided once per page load rather than per
 * component mount — see the note in that module.
 */

function readStoredSession() {
  if (typeof window === 'undefined') {
    return {
      token: '',
      baseUrl: '',
      syear: '',
      termId: '',
      profileName: '',
      profileId: '',
      subInstituteId: '',
      userId: '',
    };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    return {
      token: String(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token ?? ''),
      baseUrl: String(userData.host_name ?? ''),
      syear: String(localStorage.getItem('selectedAcademicYear') ?? userData.syear ?? userData.academic_year_id ?? ''),
      termId: String(userData.term_id ?? userData.marking_period_id ?? userData.academic_term_id ?? menuContext.term_id ?? ''),
      profileName: String(menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile ?? ''),
      profileId: String(menuContext.user_profile_id ?? userData.user_profile_id ?? userData.profile_id ?? ''),
      clientId: String(userData.client_id ?? menuContext.client_id ?? ''),
      subInstituteId: String(userData.sub_institute_id ?? menuContext.sub_institute_id ?? ''),
      userId: String(userData.user_id ?? userData.userId ?? menuContext.user_id ?? menuContext.userId ?? ''),
    };
  } catch {
    return {
      token: '',
      baseUrl: '',
      syear: '',
      termId: '',
      profileName: '',
      profileId: '',
      clientId: '',
      subInstituteId: '',
      userId: '',
    };
  }
}

/**
 * Shown only when the workspace has no configured prompts for the current route —
 * an unmapped module, or the config endpoint being unreachable. The assistant should
 * never open with an empty panel.
 */
const FALLBACK_PROMPTS = [
  'Show my homework updates',
  'What is in my activity stream today?',
  'Show my LMS dashboard progress',
  'Which students have unpaid fees?',
];

export default function ChatbotPanel({ onToggleChatbot }: { onToggleChatbot: () => void }) {
  const pathname = usePathname() || '/dashboard';
  const { executeNavigation } = useAgentActionHandler();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Runs before the first paint. On a genuine page load this wipes the stored
    // thread and returns nothing; on a panel reopen within the same page it returns
    // what was there. Doing it in an effect instead would briefly show the old
    // conversation before clearing it.
    beginChatPageSession();

    return normalizeStoredMessages(readStoredMessages<ChatMessage>());
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const idCounterRef = useRef(readMessageCounter(messages));
  const session = useMemo(() => readStoredSession(), []);

  // State rather than a memo: "New chat" replaces it. The backend keys follow-up and
  // workflow state on this id, so a fresh thread must carry a fresh one.
  const [conversationId, setConversationId] = useState(() => ensureConversationId());

  // Incremented by "New chat". An in-flight reply captures the value it started
  // under and discards itself if the thread was reset while it was on the wire —
  // otherwise the previous conversation's answer lands in the empty new one.
  const chatSessionRef = useRef(0);

  // The governed pipeline's own thread id. Separate from `conversationId` because the
  // two are different kinds of identifier — that one is a client-minted uuid, this is
  // the `ai_conversations` row the backend carries referents on, and it is what makes
  // "why is she at risk?" resolvable. Null until the first turn returns one.
  const lifecycleThreadRef = useRef<number | null>(null);

  // Which answer is currently showing its stages. One at a time: the ladder is twelve
  // rows tall, and several expanded at once turns the thread into a wall of diagnostics.
  const [openTraceId, setOpenTraceId] = useState<string | null>(null);

  // What the page says it is showing — filters, search, KPI tiles, visible rows, the
  // record it is about. Empty for a page that registers nothing, which is every page
  // that has not adopted the provider yet, and harmless when empty.
  const pageAi = usePageAiContext();

  // Resolves the current module and record from the route, refines it with what the
  // page reported, and asks the backend what the assistant can usefully offer here.
  // Failing is survivable: `availableTabs` falls back to conversation alone, which is
  // exactly what this panel was before.
  const workspace = useAiWorkspace({
    entityType: pageAi.entityType,
    entityId: pageAi.entityId,
    selectedRecords: pageAi.selectedRecords,
    pageData: pageAi.pageData,
  });
  const [activeTab, setActiveTab] = useState<Capability>('conversational');

  // Set when the user jumps to Create from a finding, so that tab runs the right
  // template on arrival instead of showing a list they have to search again.
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);

  // Content the user accepted in Create, waiting to be attached to the intervention
  // in Actions. Held in the panel because it crosses a tab boundary.
  const [acceptedDraft, setAcceptedDraft] = useState<string | null>(null);

  /**
   * Moves the user to the tab that owns the next step of the flow.
   *
   * The stage strip decides which one — the panel does not guess. That is what keeps
   * a single next action rather than five competing buttons.
   */
  const goToNextAction = useCallback((capability: Capability) => {
    setActiveTab(capability);
  }, []);

  // Navigating to a page that does not offer the open tab drops back to the
  // conversation rather than showing an empty surface.
  useEffect(() => {
    if (!workspace.availableTabs.includes(activeTab)) {
      setActiveTab('conversational');
    }
  }, [workspace.availableTabs, activeTab]);

  /**
   * The page snapshot as the conversation schema wants it.
   *
   * Sourced from the resolved workspace context rather than from the raw descriptor,
   * so the assistant reasons over exactly what the suggestion engine reasoned over —
   * already capped, already normalised, and in agreement with the prompts on screen.
   * Undefined when the page said nothing, in which case the conversation is unchanged.
   */
  const conversationPageContext = useMemo(() => {
    const page = workspace.context?.page;

    if (!page) {
      return undefined;
    }

    const snapshot = {
      title: page.title ?? undefined,
      type: page.type ?? undefined,
      filters: page.filters?.length ? page.filters : undefined,
      searchQuery: page.search_query ?? undefined,
      metrics: page.metrics?.length ? page.metrics : undefined,
      // Flattened: the schema carries attributes on the record itself, so a row reads
      // as one object rather than a label wrapping a bag.
      records: page.records?.length
        ? page.records.map((record) => ({
            id: (typeof record.id === 'string' || typeof record.id === 'number'
              ? record.id
              : undefined),
            label: record.label ?? undefined,
            ...record.attributes,
          }))
        : undefined,
      recordCount: page.record_count || undefined,
      selectedCount: workspace.context?.selected_records?.length || undefined,
      availableActions: page.available_actions?.length ? page.available_actions : undefined,
    };

    return Object.values(snapshot).some((value) => value !== undefined) ? snapshot : undefined;
  }, [workspace.context]);

  // Context-aware prompts for this page, with the static list as a safety net.
  const conversationalPrompts = useMemo(() => {
    const configured = (workspace.suggestions.conversational ?? [])
      .map((suggestion) => suggestion.prompt || suggestion.label)
      .filter((prompt): prompt is string => Boolean(prompt && prompt.trim()));

    return configured.length > 0 ? configured : FALLBACK_PROMPTS;
  }, [workspace.suggestions]);

  const {
    supportedLanguages,
    isSupported,
    language,
    setLanguage,
    transcript,
    setTranscript,
    isRecording,
    startRecording,
    stopRecording,
    isSpeaking,
    speakText,
    stopSpeaking,
    error: voiceError,
    clearError,
  } = useVoiceInteraction();

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    writeStoredMessages(messages.slice(-50));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, error, voiceError]);

  const latestAssistantMessage = useMemo(
    () =>
      [...messages].reverse().find(
        (message) => message.role === 'assistant' && message.variant !== 'error'
      ),
    [messages]
  );

  /**
   * Starts a fresh conversation without touching the page.
   *
   * Clears the thread and the stored copy, mints a new conversation id so the
   * backend does not carry follow-up state across, and stops any voice activity —
   * leaving the mic recording into a conversation the user just abandoned would be
   * a surprise.
   */
  function handleNewChat() {
    chatSessionRef.current += 1;

    if (isRecording) stopRecording();
    if (isSpeaking) stopSpeaking();

    setConversationId(startNewChatSession());
    // A new thread must not inherit the previous one's referents, or "why is she at
    // risk?" would resolve against a student the user has just walked away from.
    lifecycleThreadRef.current = null;
    setMessages([]);
    messagesRef.current = [];
    idCounterRef.current = 0;
    setInput('');
    setTranscript('');
    setError(null);
    clearError();
    setIsLoading(false);
    setActiveTab('conversational');
  }

  /**
   * Retires a confirmation prompt once it has been answered.
   *
   * @param cancelled Appends a line saying nothing was done, so the transcript
   *   records the decision rather than the prompt simply vanishing.
   */
  function clearConfirmation(messageId: string, cancelled = false) {
    setMessages((current) => {
      const next = current.map((message) =>
        message.id === messageId
          ? { ...message, confirmation: undefined, confirmationFor: undefined }
          : message
      );

      if (!cancelled) {
        return next;
      }

      idCounterRef.current += 1;
      return [
        ...next,
        {
          id: createMessageId('assistant', idCounterRef.current),
          role: 'assistant' as const,
          content: 'Cancelled — nothing was changed.',
        },
      ];
    });
  }

  /**
   * @param confirmedTools Tools the user has just authorised, when this send is a
   *   confirmation of a consequential action rather than a new question. Cleared
   *   every turn, so an authorisation never carries into a later message.
   * @param actionPayload The record an offered action was rendered against. Sent so a
   *   decision lands on the row the user was looking at rather than on whatever was
   *   most recently mentioned. The sentence still drives the intent; this only removes
   *   ambiguity about which record it applies to.
   */
  async function sendMessage(
    raw: string,
    confirmedTools?: string[],
    actionPayload?: AnswerAction['payload']
  ) {
    const trimmed = raw.trim();
    if (!trimmed || isLoading) return;

    // Captured now; compared after the await so a reply that arrives after a reset
    // is dropped instead of appended to the new thread.
    const chatSession = chatSessionRef.current;
    idCounterRef.current += 1;

    const userMessage: ChatMessage = {
      id: createMessageId('user', idCounterRef.current),
      content: trimmed,
      role: 'user',
    };

    // What the model sees always ends with the user's request, so a confirmation
    // re-drives the same tool call. What the panel shows does not repeat it — a
    // confirmation is a click, not a second question, and echoing the sentence
    // again reads as a stutter.
    const payloadMessages = [...messagesRef.current, userMessage];
    const nextMessages = confirmedTools?.length
      ? [...messagesRef.current]
      : payloadMessages;
    setMessages(nextMessages);
    setInput('');
    setTranscript('');
    setError(null);
    setIsLoading(true);

    try {
      // ---- the governed pipeline ------------------------------------------
      //
      // One call runs all twelve stages and returns the ladder that produced the
      // answer. The adapter renders it into the same shape the model route returns,
      // so everything below this branch is untouched.
      if (USE_LIFECYCLE_PIPELINE) {
        const result = await ask(
          {
            token: session.token ?? null,
            baseUrl: session.baseUrl ?? null,
            instituteId: session.subInstituteId ?? null,
            academicYear: session.syear ?? null,
            termId: session.termId ?? null,
          },
          trimmed,
          {
            conversationId: lifecycleThreadRef.current,
            payload: actionPayload,
            // The screen the question was asked from. The backend treats a declared
            // module as authoritative, so a fees question asked on the fees screen
            // does not have to say the word "fees" to route there.
            module: workspace.context?.module ?? null,
            route: pathname,
          }
        );

        if (chatSession !== chatSessionRef.current) {
          return;
        }

        lifecycleThreadRef.current = result.conversation.id ?? lifecycleThreadRef.current;

        const reply = toChatShapedReply(
          result,
          createMessageId('assistant', ++idCounterRef.current)
        );

        setMessages((current) => [
          ...current,
          {
            id: reply.message.id,
            role: 'assistant',
            content: reply.message.content,
            status: reply.response.status,
            conversationType: reply.response.conversationType,
            tools: reply.response.activeTools,
            module: reply.response.data.module,
            followUps: toActionableFollowUps(reply.response.followUpSuggestions),
            citations: reply.response.citations,
            actions: reply.actions,
            lifecycleTrace: reply.response.data.lifecycleTrace,
          },
        ]);

        return;
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({
          responseMode: 'json',
          messages: payloadMessages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
          })),
          context: {
            conversationId,
            // Present only on a confirmation turn. Without it a consequential tool
            // refuses to execute and asks again.
            confirmedTools,
            userId: session.userId,
            subInstituteId: session.subInstituteId,
            role: session.profileName,
            profileName: session.profileName,
            profileId: session.profileId,
            clientId: session.clientId,
            baseUrl: session.baseUrl,
            syear: session.syear,
            termId: session.termId,
            route: pathname,
            // The record this page is about, resolved server-side from the route.
            // This is what makes "why is this student at risk?" answerable without
            // the user naming anyone. Absent on list pages, and harmless when absent.
            entityType: workspace.context?.entity_type ?? undefined,
            entityId: workspace.context?.entity_id ?? undefined,
            entityLabel: workspace.context?.entity_label ?? undefined,
            // And what is actually on the screen — the module, the filters, the
            // figures, a window onto the rows. This is what makes "summarise these"
            // and "which of these need attention?" resolvable.
            module: workspace.context?.module ?? undefined,
            moduleLabel: workspace.context?.module_label ?? undefined,
            page: conversationPageContext,
          },
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: { id?: string; content?: string };
        response?: {
          message?: string;
          messages?: string[];
          status?: string;
          conversationType?: string;
          activeTools?: string[];
          followUpSuggestions?: string[];
          confirmation?: {
            action: string;
            riskLevel: 'low' | 'medium' | 'high';
            message: string;
            parameters?: Record<string, unknown>;
          };
          citations?: Array<{
            tool: string;
            module?: string;
            available: boolean;
            unavailableSignals?: string[];
          }>;
          navigation?: {
            route: string;
            query?: Record<string, string | number>;
            label: string;
          };
          data?: { module?: string } & Record<string, unknown>;
        };
      };

      // The user pressed "New chat" while this was in flight. Their intent was to
      // start over, so this answer is no longer wanted.
      if (chatSession !== chatSessionRef.current) {
        return;
      }

      // 403 carries a real assistant reply explaining what the user may not do.
      // Rendering it as a normal message keeps a routine refusal from looking like
      // a breakage; anything else non-OK is a genuine failure.
      const isRefusal = response.status === 403 && Boolean(payload.message?.content);

      if (!response.ok && !isRefusal) {
        throw new Error(payload.error || 'The AI assistant request failed.');
      }

      const assistantMessages = [
        payload.response?.message?.trim() || payload.message?.content?.trim() || 'No visible response was returned.',
        ...(payload.response?.messages || []).filter((message): message is string => typeof message === 'string' && message.trim().length > 0),
      ];

      setMessages((current) => {
        const nextMessages = [...current];
        assistantMessages.forEach((content, index) => {
          nextMessages.push({
            id:
              index === 0
                ? payload.message?.id || createMessageId('assistant', ++idCounterRef.current)
                : createMessageId('assistant', ++idCounterRef.current),
            role: 'assistant',
            content,
            status: payload.response?.status,
            conversationType: payload.response?.conversationType,
            tools: payload.response?.activeTools,
            navigation: payload.response?.navigation,
            module:
              typeof payload.response?.data?.module === 'string'
                ? payload.response.data.module
                : undefined,
            // Only on the last bubble of a reply — repeating the same chips under
            // every part of a multi-part answer reads as a stutter.
            // A chip's label is sent verbatim as the next question, so only offer the
            // ones that read as something a user could actually say. "Reply with the
            // numbered option if shown." is advice, not an utterance — clicking it
            // asked that sentence, matched nothing, and looped.
            followUps:
              index === assistantMessages.length - 1
                ? toActionableFollowUps(payload.response?.followUpSuggestions)
                : undefined,
            // Same rule as the chips: sources belong under the last bubble only.
            citations:
              index === assistantMessages.length - 1
                ? payload.response?.citations
                : undefined,
            confirmation:
              index === assistantMessages.length - 1
                ? payload.response?.confirmation
                : undefined,
            confirmationFor:
              index === assistantMessages.length - 1 && payload.response?.confirmation
                ? trimmed
                : undefined,
          });
        });
        return nextMessages;
      });
    } catch (value: unknown) {
      // Same guard on the failure path: a stale error is as unwelcome as a stale answer.
      if (chatSession !== chatSessionRef.current) {
        return;
      }

      const message =
        value instanceof Error ? value.message : 'The AI assistant request failed.';
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId('assistant-error', ++idCounterRef.current),
          role: 'assistant',
          content: message,
          variant: 'error',
        },
      ]);
    } finally {
      if (chatSession === chatSessionRef.current) {
        setIsLoading(false);
      }
    }
  }

  const handleSend = () => {
    void sendMessage(transcript || input);
  };

  return (
    <aside className="h-full w-full overflow-hidden rounded-[28px] border border-gray-200/60 bg-white/92 shadow-[0_18px_55px_rgba(15,23,42,0.1)] backdrop-blur-xl">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200/70 bg-white/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-2xl text-white shadow-[0_10px_24px_rgba(13,110,253,0.2)]"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <BotIcon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Teach Assistant</h3>
              <p className="text-[11px] font-medium text-gray-500">Text, voice, and multilingual AI</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={messages.length === 0 && !isLoading}
              className="rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
              title="New chat"
              aria-label="Start a new chat"
            >
              <SquarePen size={17} aria-hidden="true" />
            </button>
            <button
              onClick={onToggleChatbot}
              className="rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title="Collapse Chatbot"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>

        {/*
          What the assistant is currently looking at, and the abilities that make
          sense here. Both come from the resolved route, so walking from a student
          page to the fees list changes them without reopening the panel.
        */}
        <ContextBanner context={workspace.context} loading={workspace.loading} />
        <WorkspaceTabs
          tabs={workspace.availableTabs}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab !== 'conversational' ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {activeTab === 'generative' ? (
              <CreateTab
                session={workspace.session}
                context={workspace.context}
                suggestions={workspace.suggestions.generative ?? []}
                route={workspace.route}
                presetTemplateKey={pendingTemplate}
                onUse={(text) => {
                  // Carried to Actions, where it is attached to the proposed
                  // intervention — still behind the approval gate.
                  setAcceptedDraft(text);
                  setPendingTemplate(null);
                  setActiveTab('workflow');
                }}
              />
            ) : null}

            {activeTab === 'agent' ? (
              <AnalyseTab
                session={workspace.session}
                context={workspace.context}
                suggestions={workspace.suggestions.agent ?? []}
                route={workspace.route}
                onSeeActions={() => setActiveTab('workflow')}
                onGenerate={(templateKey) => {
                  setPendingTemplate(templateKey);
                  setActiveTab('generative');
                }}
                onCompleted={workspace.reloadFlow}
              />
            ) : null}

            {activeTab === 'workflow' ? (
              <ActionsTab
                session={workspace.session}
                context={workspace.context}
                suggestions={workspace.suggestions.workflow ?? []}
                pendingRecommendations={workspace.active.pending_recommendations}
                route={workspace.route}
                acceptedDraft={acceptedDraft}
                onDismissDraft={() => setAcceptedDraft(null)}
                onChanged={() => {
                  void workspace.reload();
                  void workspace.reloadFlow();
                }}
              />
            ) : null}

            {activeTab === 'ontology' ? (
              <ConnectionsTab
                session={workspace.session}
                context={workspace.context}
                views={workspace.ontologyViews}
                route={workspace.route}
              />
            ) : null}
          </div>
        ) : (
        <>
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {/*
            The structured spine beside the free-text conversation: what has been
            established about this record so far, and the one thing to do next.
            Derived from real rows, so it stays true regardless of what was said in
            chat. Absent on list pages, where there is no single record to track.
          */}
          {workspace.flow?.applicable ? (
            <div className="pt-5">
              <FlowStrip flow={workspace.flow} onAct={(capability) => goToNextAction(capability)} />
            </div>
          ) : null}

          {messages.length === 0 && workspace.loading && !workspace.payload ? (
            /*
              Resolving. Showing the static fallback here and swapping it a moment
              later reads as the panel changing its mind, so it waits instead.
            */
            <div className="py-5" aria-busy="true">
              <p className="mb-2 text-xs font-medium text-gray-900">Suggested prompts</p>
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="h-[42px] animate-pulse rounded-2xl border border-gray-200/60 bg-gray-100/70"
                  />
                ))}
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-5">
              <p className="mb-2 text-xs font-medium text-gray-900">
                {workspace.context?.entity_label
                  ? `About ${workspace.context.entity_label}`
                  : workspace.context?.module_label
                    ? `In ${workspace.context.module_label}`
                    : 'Suggested prompts'}
              </p>
              <div className="flex flex-col gap-1.5">
                {conversationalPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-2xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-gray-700 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#0D6EFD]/20 hover:bg-blue-50/70 hover:text-[#0D6EFD] hover:shadow-[0_10px_24px_rgba(13,110,253,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' ? (
                    <div
                      className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_18px_rgba(13,110,253,0.16)]"
                      style={{ background: 'var(--accent-gradient)' }}
                    >
                      <BotIcon className="size-4" aria-hidden="true" />
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      'max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-4 py-3 text-sm leading-7 shadow-sm',
                      message.role === 'user'
                        ? 'border border-[#0D6EFD]/10 bg-[#0D6EFD] text-white shadow-[0_12px_30px_rgba(13,110,253,0.18)]'
                        : message.variant === 'error'
                          ? 'border border-red-200 bg-red-50 text-red-700'
                          : 'border border-gray-200/80 bg-white text-gray-800 shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
                    )}
                  >
                    {/*
                      Conversation type, pipeline status and tool names are
                      internal routing details. They used to render as chips
                      above every answer, which put strings like the analysis
                      tool's own name in front of the user. The assistant should
                      read as an assistant, so only the answer is shown.
                    */}
                    {message.content}
                    {message.role === 'assistant' && message.navigation ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-slate-800">
                        <h4 className="text-sm font-semibold">
                          {getHandoffCopy(message.module).title}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {getHandoffCopy(message.module).description}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            executeNavigation(message.navigation);
                          }}
                          className="mt-3 rounded-xl bg-[#0D6EFD] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0D6EFD]/90"
                        >
                          {message.navigation.label}
                        </button>
                      </div>
                    ) : null}

                    {/*
                      A real change, held until the user agrees to it. The tool has
                      already declined to run once; nothing happens until Confirm is
                      pressed, and the prompt disappears either way so it cannot be
                      answered twice.
                    */}
                    {message.role === 'assistant' && message.confirmation ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                        <p className="text-xs font-medium text-amber-900">
                          Confirm this action
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-amber-800">
                          {message.confirmation.message}
                        </p>
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => {
                              const action = message.confirmation!.action;
                              const question = message.confirmationFor || '';
                              clearConfirmation(message.id);
                              void sendMessage(question, [action]);
                            }}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => clearConfirmation(message.id, true)}
                            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/*
                      What the answer rests on. Kept on every assistant turn rather
                      than only the newest: the point of a source line is that it stays
                      checkable after the conversation has moved on.
                    */}
                    {message.role === 'assistant' && message.citations?.length ? (
                      <div className="mt-2.5 border-t border-gray-100 pt-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                          Sources
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {message.citations.map((citation) => (
                            <li key={citation.tool} className="text-[11px] leading-snug text-gray-500">
                              <span className={citation.available ? '' : 'text-amber-600'}>
                                {citation.module || citation.tool}
                                {citation.available ? '' : ' — no data returned'}
                              </span>
                              {citation.unavailableSignals?.length ? (
                                <span className="text-amber-600">
                                  {' '}
                                  · not recorded: {citation.unavailableSignals.join(', ')}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/*
                      Decisions the answer is asking for — approve, reject, and anything
                      else that needs a person.

                      Rendered as buttons rather than chips because they are not
                      suggestions: clicking one records a decision against a named record
                      and, on approval, starts a workflow. Each carries the id it was
                      rendered against, so the decision lands on the record the user was
                      looking at rather than on whatever was most recently mentioned.

                      Offered under the latest answer only. A stale approve button is
                      the one piece of stale UI in this panel that could do real harm.
                    */}
                    {message.role === 'assistant' &&
                    message.id === messages[messages.length - 1]?.id &&
                    message.actions?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            onClick={() =>
                              void sendMessage(action.utterance, undefined, action.payload)
                            }
                            disabled={isLoading}
                            className={
                              action.style === 'danger'
                                ? 'rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
                                : 'rounded-lg border border-transparent bg-[#0D6EFD] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0b5ed7] disabled:cursor-not-allowed disabled:opacity-50'
                            }
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/*
                      Where the conversation can go next, offered only under the most
                      recent answer. Older turns keep their text but lose their chips —
                      a follow-up to a question three turns back is rarely what the
                      user now means, and a panel full of stale chips is noise.
                    */}
                    {message.role === 'assistant' &&
                    message.id === messages[messages.length - 1]?.id &&
                    message.followUps?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {message.followUps.slice(0, 4).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => void sendMessage(suggestion)}
                            disabled={isLoading}
                            className="rounded-full border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-[#0D6EFD]/25 hover:bg-blue-50 hover:text-[#0D6EFD] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/*
                      How this answer was produced.

                      Offered on every assistant turn, not only the latest: scrolling
                      back to an earlier answer should show the stages that produced
                      *it*. Collapsed by default, because the ladder is twelve rows and
                      most of the time the answer is the point — but one click away,
                      because the moment anyone doubts a number, "which stage read
                      which table" is the only thing that settles it.
                    */}
                    {message.role === 'assistant' && message.lifecycleTrace?.length ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenTraceId((current) => (current === message.id ? null : message.id))
                          }
                          aria-expanded={openTraceId === message.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-[#0D6EFD]/25 hover:text-[#0D6EFD]"
                        >
                          {(() => {
                            const ran = message.lifecycleTrace.filter((s) => s.status === 'ran').length;
                            const blocked = message.lifecycleTrace.some((s) => s.status === 'blocked');
                            const waiting = message.lifecycleTrace.some((s) => s.status === 'pending');

                            return (
                              <>
                                <span
                                  className={
                                    blocked
                                      ? 'size-1.5 rounded-full bg-red-500'
                                      : waiting
                                        ? 'size-1.5 rounded-full bg-amber-500'
                                        : 'size-1.5 rounded-full bg-emerald-500'
                                  }
                                  aria-hidden
                                />
                                {openTraceId === message.id ? 'Hide' : 'How this was answered'}
                                <span className="tabular-nums text-gray-400">
                                  {ran}/{message.lifecycleTrace.length}
                                </span>
                              </>
                            );
                          })()}
                        </button>

                        {openTraceId === message.id ? (
                          <LifecycleTrace stages={message.lifecycleTrace} className="mt-2" />
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {message.role === 'user' ? (
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
                      <User className="size-4 text-gray-600" aria-hidden="true" />
                    </div>
                  ) : null}
                </div>
              ))}

              {isLoading ? (
                <div className="flex justify-start gap-3">
                  <div
                    className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_18px_rgba(13,110,253,0.16)]"
                    style={{ background: 'var(--accent-gradient)' }}
                  >
                    <BotIcon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span>Thinking through your request...</span>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}

              {voiceError ? (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{voiceError}</span>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-gray-200/70 bg-white/80 px-5 py-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => {
                if (transcript) {
                  setTranscript('');
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              value={transcript || input}
              placeholder="Ask about homework, dashboard, results, fees, or workflows..."
              disabled={isLoading}
              className={cn(
                'h-11 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm',
                'placeholder:text-gray-400 outline-none transition-all duration-200',
                'focus-visible:border-[#0D6EFD]/40 focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/15 disabled:cursor-not-allowed disabled:opacity-70'
              )}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!(transcript || input).trim() || isLoading}
              aria-label="Send message"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_rgba(13,110,253,0.22)]',
                'transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/20',
                'hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50'
              )}
              style={{ background: 'var(--accent-gradient)' }}
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          </div>

          {transcript ? (
            <div className="mb-3 rounded-2xl border border-[#0D6EFD]/15 bg-blue-50/80 px-3 py-2 text-xs leading-5 text-[#0D6EFD]">
              Voice transcript ready:
              <span className="ml-1 text-gray-800">{transcript}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <div className="min-w-0">
              <Select
                value={language}
                onValueChange={(value) => {
                  clearError();
                  setLanguage(value ?? 'en-IN');
                }}
              >
                <SelectTrigger className="w-full" aria-label="Voice language">
                  <SelectValue placeholder="Voice language" />
                </SelectTrigger>
                <SelectContent>
                  {supportedLanguages.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant={isRecording ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => {
                clearError();
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
              disabled={!isSupported}
            >
              {isRecording ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
              {isRecording ? 'Stop' : 'Voice'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                } else if (latestAssistantMessage?.content) {
                  speakText(latestAssistantMessage.content);
                }
              }}
              disabled={!latestAssistantMessage?.content}
            >
              {isSpeaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              {isSpeaking ? 'Mute' : 'Replay'}
            </Button>
          </div>

          {isRecording ? (
            <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-red-600">
              Recording in progress...
            </div>
          ) : null}
        </div>
        </>
        )}
      </div>
    </aside>
  );
}
