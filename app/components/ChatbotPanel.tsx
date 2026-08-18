'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot as BotIcon,
  ChevronLeft,
  Loader2,
  Mic,
  Send,
  Square,
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
  TEACH_ASSISTANT_CONVERSATION_ID_KEY,
  TEACH_ASSISTANT_MESSAGES_KEY,
} from '@/lib/chatbot-storage';

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
};

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

function ensureConversationId() {
  if (typeof window === 'undefined') {
    return 'server-conversation';
  }

  const existing = localStorage.getItem(TEACH_ASSISTANT_CONVERSATION_ID_KEY);
  if (existing) {
    return existing;
  }

  const nextId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `conversation-${Date.now()}`;
  localStorage.setItem(TEACH_ASSISTANT_CONVERSATION_ID_KEY, nextId);
  return nextId;
}

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

const SUGGESTED_PROMPTS = [
  'Show my homework updates',
  'What is in my activity stream today?',
  'Show my LMS dashboard progress',
  'Which students have unpaid fees?',
];

export default function ChatbotPanel({ onToggleChatbot }: { onToggleChatbot: () => void }) {
  const pathname = usePathname() || '/dashboard';
  const { executeNavigation } = useAgentActionHandler();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(TEACH_ASSISTANT_MESSAGES_KEY);
      return stored
        ? normalizeStoredMessages(JSON.parse(stored) as ChatMessage[])
        : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const idCounterRef = useRef(readMessageCounter(messages));
  const session = useMemo(() => readStoredSession(), []);
  const conversationId = useMemo(() => ensureConversationId(), []);

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
    if (typeof window === 'undefined') return;
    localStorage.setItem(TEACH_ASSISTANT_MESSAGES_KEY, JSON.stringify(messages.slice(-50)));
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

  async function sendMessage(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || isLoading) return;
    idCounterRef.current += 1;

    const userMessage: ChatMessage = {
      id: createMessageId('user', idCounterRef.current),
      content: trimmed,
      role: 'user',
    };

    const nextMessages = [...messagesRef.current, userMessage];
    setMessages(nextMessages);
    setInput('');
    setTranscript('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({
          responseMode: 'json',
          messages: nextMessages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
          })),
          context: {
            conversationId,
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
          navigation?: {
            route: string;
            query?: Record<string, string | number>;
            label: string;
          };
          data?: { module?: string } & Record<string, unknown>;
        };
      };

      if (!response.ok) {
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
          });
        });
        return nextMessages;
      });
    } catch (value: unknown) {
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
      setIsLoading(false);
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
          <button
            onClick={onToggleChatbot}
            className="rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            title="Collapse Chatbot"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {messages.length === 0 ? (
            <div className="py-5">
              <p className="mb-2 text-xs font-medium text-gray-900">Suggested prompts</p>
              <div className="flex flex-col gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
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
      </div>
    </aside>
  );
}
