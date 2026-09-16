
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

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

import { useVoiceInteraction } from '@/hooks/use-voice-interaction';
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
  readLifecycleThreadId,
  readStoredMessages,
  startNewChatSession,
  writeLifecycleThreadId,
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
// The governed twelve-stage pipeline, reached through `/api/ai/ask/stream` — a thin
// Next route that forwards to Laravel and translates its SSE into the AI SDK's UI
// message protocol. The SDK owns the transport, the streaming state and the abort; it
// owns nothing about the answer.
import {
  toPanelMessage,
  usableStoredMessages,
  textOf,
  type AskUIMessage,
  type PanelMessage,
} from '@/lib/intelligence/ui-messages';
import type { AnswerAction } from '@/lib/intelligence/types';
import { LifecycleTrace } from '@/components/intelligence/LifecycleTrace';
import { AnswerSections } from '@/components/intelligence/AnswerSections';
import { moduleHandoffFor } from '@/lib/intelligence/module-handoff';
import { useAgentActionHandler } from '@/hooks/use-agent-action-handler';
import { ActionsTab } from './ai-workspace/ActionsTab';
import { AnalyseTab } from './ai-workspace/AnalyseTab';
import { ConnectionsTab } from './ai-workspace/ConnectionsTab';
import { CreateTab } from './ai-workspace/CreateTab';
import { ContextBanner, WorkspaceTabs } from './ai-workspace/WorkspaceChrome';
import { FlowStrip } from './ai-workspace/FlowStrip';

/** The ladder's real height, so a partial count does not read as a finished one. */
const LIFECYCLE_STAGE_COUNT = 12;

/**
 * Marks a still-streaming ladder the user has closed by hand.
 *
 * Held in the same slot as the open id, because at most one ladder is ever open and
 * two pieces of state that can disagree about that is how a panel ends up showing
 * both.
 */
function closedTraceKey(messageId: string) {
  return `closed:${messageId}`;
}

/**
 * What this panel draws for one turn.
 *
 * Derived from an SDK message rather than held as panel state: the answer text, the
 * offered actions, the citations and the twelve-stage ladder all arrive as parts of
 * the streaming message, and `toPanelMessage` reads them back out. Keeping the shape
 * the panel always spoke means the render below did not change when the transport did.
 */
type ChatMessage = PanelMessage;

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
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const session = useMemo(() => readStoredSession(), []);

  /**
   * The thread the SDK is currently driving.
   *
   * Both halves change together and only on "New chat". `useChat` rebuilds its Chat
   * when the id changes and seeds it from `messages` at that moment, so resetting the
   * id while still handing back the old transcript would restore the conversation the
   * user just cleared.
   */
  const [thread, setThread] = useState<{ id: string; seed: AskUIMessage[] }>(() => {
    // Runs before the first paint. On a genuine page load this wipes the stored
    // thread and returns nothing; on a panel reopen within the same page it returns
    // what was there. Doing it in an effect instead would briefly show the old
    // conversation before clearing it.
    beginChatPageSession();

    return {
      id: `teach-assistant-${Date.now()}`,
      seed: usableStoredMessages(readStoredMessages<unknown>()),
    };
  });

  // The thread this conversation belongs to: the `ai_conversations` row the backend
  // carries referents on, and what makes "why is she at risk?" resolvable. Minted by
  // the backend, so it is null until the first turn returns one.
  //
  // Hydrated from sessionStorage, not initialised to null. The panel is unmounted while
  // collapsed (`{isChatbotOpen && <ChatbotPanel/>}` in DashboardShell), so a plain ref
  // was reset every time the user closed and reopened it — while the transcript, which
  // is persisted, came back in full. The next question then went to the backend with no
  // conversation id, opened a second thread, and lost every referent from the visible
  // conversation above it. The thread id has to persist on exactly the same terms as
  // the messages: cleared by "New chat" and once per page load, kept across remounts.
  const lifecycleThreadRef = useRef<number | null>(null);
  const lifecycleThreadHydrated = useRef(false);

  if (!lifecycleThreadHydrated.current) {
    lifecycleThreadHydrated.current = true;
    lifecycleThreadRef.current = readLifecycleThreadId();
  }

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
   * How a question reaches Laravel.
   *
   * `prepareSendMessagesRequest` is where the SDK's world ends and this platform's
   * begins. The SDK wants to POST a message history; the lifecycle wants one question,
   * a thread id, and the scope headers. Translating here rather than in the route
   * keeps the route a pure SSE translator, and keeps the tenant headers built the one
   * way `lib/intelligence/client.ts` builds them.
   *
   * Memoised on the session alone. Everything that changes per turn — the thread id,
   * the module, the route, the record an Approve button was rendered against — arrives
   * in `body` from the individual `sendMessage` call, so navigating between pages
   * never rebuilds the transport underneath an in-flight answer.
   */
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AskUIMessage>({
        api: '/api/ai/ask/stream',
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          const turn = (body ?? {}) as {
            conversationId?: number | null;
            payload?: AnswerAction['payload'];
            module?: string | null;
            route?: string | null;
          };

          return {
            headers: {
              'Content-Type': 'application/json',
              ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
              // A *selection* within the caller's allowed set, not a grant. The
              // backend rejects anything outside it.
              ...(session.subInstituteId
                ? { 'X-MCP-Institute-Id': String(session.subInstituteId) }
                : {}),
            },
            body: {
              question: last ? textOf(last) : '',
              conversation_id: turn.conversationId ?? null,
              payload: turn.payload ?? {},
              module: turn.module ?? null,
              route: turn.route ?? null,
              meta: {
                ...(session.subInstituteId
                  ? { institute_id: Number(session.subInstituteId) }
                  : {}),
                ...(session.syear ? { academic_year: Number(session.syear) } : {}),
                ...(session.termId ? { term_id: Number(session.termId) } : {}),
              },
            },
          };
        },
      }),
    [session]
  );

  const {
    messages: uiMessages,
    sendMessage: sendUiMessage,
    status,
    stop,
    error,
  } = useChat<AskUIMessage>({
    id: thread.id,
    messages: thread.seed,
    transport,
    // The thread id arrives with the finished answer and has to survive the panel
    // being collapsed, which unmounts it. Written the moment it lands rather than on
    // unmount, because an unmount handler is not guaranteed to run first.
    onData: (part) => {
      if (part.type !== 'data-ask') return;

      const conversationId = part.data.conversationId;

      if (conversationId != null) {
        lifecycleThreadRef.current = conversationId;
        writeLifecycleThreadId(conversationId);
      }
    },
  });

  /** Busy covers both halves of a turn: waiting for the first byte, and streaming. */
  const isLoading = status === 'submitted' || status === 'streaming';

  // What the panel draws. The SDK owns the parts; this reads them back into the shape
  // the render below has always spoken.
  //
  // A chip's label is sent verbatim as the next question, so only the suggestions that
  // read as something a user could actually say survive: "Reply with the numbered
  // option if shown." is advice, not an utterance — clicking it asked that sentence,
  // matched nothing, and looped.
  const messages = useMemo<ChatMessage[]>(
    () =>
      uiMessages.map((message) => {
        const panel = toPanelMessage(message);

        return { ...panel, followUps: toActionableFollowUps(panel.followUps) };
      }),
    [uiMessages]
  );

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

  // The SDK messages are what gets persisted, not the rendered view of them: parts
  // rehydrate into the same panel message, and a stored view model would not.
  useEffect(() => {
    writeStoredMessages(uiMessages.slice(-50));
  }, [uiMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, error, voiceError]);

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages]
  );

  /**
   * Starts a fresh conversation without touching the page.
   *
   * A new chat id is what actually resets the SDK: `useChat` rebuilds its Chat when
   * the id changes, which drops the transcript, the streaming state and any in-flight
   * request together. Seeding it with nothing is what stops the cleared conversation
   * coming back.
   */
  function handleNewChat() {
    if (isLoading) stop();
    if (isRecording) stopRecording();
    if (isSpeaking) stopSpeaking();

    // Called for the clearing it does, not the id it returns: the thread the backend
    // reasons over is `lifecycleThreadRef`, and it is cleared immediately below.
    startNewChatSession();
    // A new thread must not inherit the previous one's referents, or "why is she at
    // risk?" would resolve against a student the user has just walked away from.
    lifecycleThreadRef.current = null;
    writeLifecycleThreadId(null);
    setThread({ id: `teach-assistant-${Date.now()}`, seed: [] });
    setInput('');
    setTranscript('');
    clearError();
    setActiveTab('conversational');
  }

  /**
   * Ask a question.
   *
   * @param actionPayload The record an offered action was rendered against. Sent so a
   *   decision lands on the row the user was looking at rather than on whatever was
   *   most recently mentioned. The sentence still drives the intent; this only removes
   *   ambiguity about which record it applies to.
   * @param actionModule The module that offered the action. A decision must stay in
   *   the module that created its recommendation: the panel can be opened on another
   *   page before Approve is clicked, and using that page's module would make the
   *   backend lose the agent and workflow binding.
   */
  function sendMessage(
    raw: string,
    actionPayload?: AnswerAction['payload'],
    actionModule?: string
  ) {
    const trimmed = raw.trim();

    if (!trimmed || isLoading) return;

    setInput('');
    setTranscript('');

    void sendUiMessage(
      { text: trimmed },
      {
        body: {
          // Read here rather than inside the transport: this runs in an event
          // handler, where the thread the user is actually looking at is current.
          conversationId: lifecycleThreadRef.current,
          payload: actionPayload ?? {},
          // The screen the question was asked from. The backend treats a declared
          // module as authoritative, so a fees question asked on the fees screen does
          // not have to say the word "fees" to route there.
          module: actionModule ?? workspace.context?.module ?? null,
          route: pathname,
        },
      }
    );
  }

  const handleSend = () => {
    sendMessage(transcript || input);
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
                    {/*
                      A finished answer is drawn from its sections; a streaming one from
                      the text arriving. Both are the same words — the sections are the
                      same content with its structure intact, so the bubble does not
                      change what it says when the turn lands, only how it is laid out.
                    */}
                    {message.role === 'assistant' && message.sections.length ? (
                      <AnswerSections
                        sections={message.sections}
                        module={message.module}
                        onAsk={(question) => sendMessage(question, undefined, message.module)}
                        className="-mx-1"
                      />
                    ) : (
                      message.content
                    )}

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
                              void sendMessage(action.utterance, action.payload, message.module)
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
                      Where the conversation leaves you.

                      Restored after the model-driven chat route was retired: that route
                      stamped a `navigation` object on its reply, and when it went, so did
                      this card. It is rebuilt from `links` — the records the turn actually
                      touched — so the destination is a specific enrolment or student
                      rather than a module's front door.
                    */}
                    {(() => {
                      if (message.role !== 'assistant' || !message.isComplete) return null;

                      const handoff = moduleHandoffFor(message.module, message.links, message.actions);

                      if (!handoff) return null;

                      return (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                          <h4 className="text-sm font-semibold text-emerald-900">{handoff.title}</h4>
                          <p className="mt-0.5 text-xs leading-5 text-emerald-800/80">
                            {handoff.description}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              executeNavigation({
                                route: handoff.route,
                                query: handoff.query,
                                label: handoff.label,
                              })
                            }
                            className="mt-2.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                          >
                            {handoff.label}
                          </button>
                        </div>
                      );
                    })()}

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
                      *it*. Collapsed once it is finished, because the ladder is twelve
                      rows and most of the time the answer is the point — but one click
                      away, because the moment anyone doubts a number, "which stage read
                      which table" is the only thing that settles it.

                      Open while it is still filling in. A ladder growing row by row is
                      the one moment the stages are worth more than the answer, and it
                      is the whole reason the backend streams them.
                    */}
                    {message.role === 'assistant' && message.lifecycleTrace?.length
                      ? (() => {
                          const live = !message.isComplete && isLoading;
                          const traceOpen =
                            openTraceId === message.id
                            || (live && openTraceId !== closedTraceKey(message.id));
                          const ran = message.lifecycleTrace.filter((s) => s.status === 'ran').length;
                          const blocked = message.lifecycleTrace.some((s) => s.status === 'blocked');
                          const waiting = message.lifecycleTrace.some((s) => s.status === 'pending');

                          return (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenTraceId(
                                    traceOpen
                                      ? // Closing a ladder that is still streaming has
                                        // to be remembered, or the next stage to arrive
                                        // would re-open what the user just dismissed.
                                        (live ? closedTraceKey(message.id) : null)
                                      : message.id
                                  )
                                }
                                aria-expanded={traceOpen}
                                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-[#0D6EFD]/25 hover:text-[#0D6EFD]"
                              >
                                <span
                                  className={cn(
                                    'size-1.5 rounded-full',
                                    blocked
                                      ? 'bg-red-500'
                                      : live
                                        ? 'animate-pulse bg-[#0D6EFD]'
                                        : waiting
                                          ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                  )}
                                  aria-hidden
                                />
                                {traceOpen ? 'Hide agent activity' : live ? 'Agent working' : 'Agent activity'}
                                <span className="tabular-nums text-gray-400">
                                  {/*
                                    While the turn runs the denominator is only the
                                    stages that have reported, so it climbs as 1/1, 2/2.
                                    Twelve is the ladder's real height and saying so
                                    keeps the count from reading as "already finished".
                                  */}
                                  {ran}/{live ? LIFECYCLE_STAGE_COUNT : message.lifecycleTrace.length}
                                </span>
                              </button>

                              {traceOpen ? (
                                <LifecycleTrace stages={message.lifecycleTrace} className="mt-2" />
                              ) : null}
                            </div>
                          );
                        })()
                      : null}
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
                    {/*
                      Two different waits, and saying which one is honest: before the
                      first byte the backend is still choosing tools and reading rows;
                      after it, the answer is arriving and the ladder above is filling
                      in. Only the first needs a placeholder bubble at all.
                    */}
                    <span>
                      {status === 'submitted'
                        ? 'Thinking through your request...'
                        : 'Answering...'}
                    </span>
                    <button
                      type="button"
                      onClick={() => stop()}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error.message || 'The AI assistant request failed.'}</span>
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
