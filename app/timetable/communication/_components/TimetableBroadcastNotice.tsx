'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/result/toast';
import {
  recordBatchDispatches,
  recordDispatch,
} from '@/lib/communication/dispatch-store';

type Channel = 'sms' | 'email' | 'whatsapp' | 'portal';

interface Template {
  id: string;
  name: string;
  channel: Channel;
  subject: string;
  body: string;
  tag: string;
}

interface AudienceRecipient {
  id: string;
  name: string;
  role: string;
  contact: string;
  email: string;
  classOrSubject?: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'timetable-published',
    name: 'Weekly Timetable Published / Schedule Update',
    channel: 'whatsapp',
    subject: 'New Class Timetable Published & Active',
    body: 'Dear {recipient_name}, the updated weekly timetable for {class_name} has been published and is now active. Please check the timetable portal or student app for period timings and room assignments.',
    tag: 'Schedule Published',
  },
  {
    id: 'proxy-duty-assigned',
    name: 'Substitute Teacher Duty Assignment (Proxy Notice)',
    channel: 'sms',
    subject: 'Proxy Class Duty Assignment Alert',
    body: 'Dear {recipient_name}, you have been assigned proxy teaching duty for {class_name} during Period {period_no} today in Room {room_no}. Please report on time.',
    tag: 'Proxy Duty',
  },
  {
    id: 'bell-timings-revised',
    name: 'Period Timing & Bell Schedule Change Advisory',
    channel: 'whatsapp',
    subject: 'Revised School Bell Timings Notice',
    body: 'Dear Faculty & Parents, please note that school timetable period timings have been revised effective tomorrow. Morning assembly begins at 07:45 AM followed by Period 1 at 08:15 AM.',
    tag: 'Bell Timings',
  },
  {
    id: 'remedial-classes',
    name: 'Special Class & Extra Coaching Timetable',
    channel: 'sms',
    subject: 'Remedial / Extra Class Timetable Scheduled',
    body: 'Dear Parent, special remedial coaching classes for {student_name} have been scheduled on Saturday from 08:30 AM to 11:30 AM. Attendance is mandatory.',
    tag: 'Coaching',
  },
];

const PRESET_AUDIENCE: AudienceRecipient[] = [
  { id: '1', name: 'Ramesh Sharma', role: 'Faculty / Mathematics', contact: '+91 98250 12345', email: 'ramesh.sharma@school.edu', classOrSubject: 'Grade 10 Mathematics' },
  { id: '2', name: 'Sunita Verma', role: 'Faculty / Science', contact: '+91 98251 12345', email: 'sunita.verma@school.edu', classOrSubject: 'Grade 9 Physics' },
  { id: '3', name: 'Kavita Dave', role: 'Class Teacher / Grade 10-A', contact: '+91 98795 67890', email: 'kavita.dave@school.edu', classOrSubject: 'Class 10-A' },
  { id: '4', name: 'Anil Joshi', role: 'Faculty / English', contact: '+91 97243 54321', email: 'anil.joshi@school.edu', classOrSubject: 'Grade 8-10 English' },
];

export function TimetableBroadcastNotice() {
  const router = useRouter();

  const [selectedChannel, setSelectedChannel] = useState<Channel>('whatsapp');
  const [targetAudience, setTargetAudience] = useState<'all' | 'unregistered' | 'custom'>('custom');
  const [customMobile, setCustomMobile] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [message, setMessage] = useState(TEMPLATES[0].body);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const isEmail = selectedChannel === 'email';

  // Parse 10-digit mobile numbers for WhatsApp / SMS
  const parsedCustomNumbers = useMemo(() => {
    if (targetAudience !== 'custom' || isEmail) return [];
    const rawTokens = customMobile.split(/[\n,; ]+/).map((t) => t.trim()).filter(Boolean);
    const valid: string[] = [];
    for (const token of rawTokens) {
      const cleaned = token.replace(/[^0-9+]/g, '');
      const digits = cleaned.replace(/\D/g, '');
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      if (last10.length === 10 && /^[6-9]\d{9}$/.test(last10)) {
        if (!valid.includes(last10)) {
          valid.push(last10);
        }
      }
    }
    return valid;
  }, [customMobile, targetAudience, isEmail]);

  // Parse email addresses for Email Digest
  const parsedCustomEmails = useMemo(() => {
    if (targetAudience !== 'custom' || !isEmail) return [];
    const rawTokens = customEmail.split(/[\n,; ]+/).map((t) => t.trim()).filter(Boolean);
    const valid: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const token of rawTokens) {
      const lower = token.toLowerCase();
      if (emailRegex.test(lower) && !valid.includes(lower)) {
        valid.push(lower);
      }
    }
    return valid;
  }, [customEmail, targetAudience, isEmail]);

  const activeRecipients: AudienceRecipient[] = useMemo(() => {
    if (targetAudience === 'custom') {
      if (isEmail) {
        if (parsedCustomEmails.length === 0) return [];
        return parsedCustomEmails.map((em, idx) => ({
          id: `custom-email-${idx}`,
          name: customRecipientName.trim() || `Recipient ${idx + 1}`,
          role: 'Faculty / Parent Recipient',
          contact: em,
          email: em,
        }));
      } else {
        if (parsedCustomNumbers.length === 0) return [];
        return parsedCustomNumbers.map((num, idx) => ({
          id: `custom-${idx}`,
          name: customRecipientName.trim() || `Recipient ${idx + 1}`,
          role: 'Faculty / Parent Recipient',
          contact: `+91 ${num}`,
          email: '',
        }));
      }
    }
    if (targetAudience === 'unregistered') {
      return PRESET_AUDIENCE.slice(0, 2);
    }
    return PRESET_AUDIENCE;
  }, [targetAudience, isEmail, parsedCustomEmails, parsedCustomNumbers, customRecipientName]);

  const previewText = useMemo(() => {
    const first = activeRecipients[0];
    const name = first ? first.name : 'Faculty / Parent';
    return message
      .replace(/\{recipient_name\}/g, name)
      .replace(/\{class_name\}/g, 'Class 10-A')
      .replace(/\{period_no\}/g, '3')
      .replace(/\{room_no\}/g, 'Room 204')
      .replace(/\{student_name\}/g, name);
  }, [message, activeRecipients]);

  const handleApplyTemplate = (tpl: Template) => {
    setSelectedChannel(tpl.channel);
    setSubject(tpl.subject);
    setMessage(tpl.body);
    toast.success('Template Applied', `"${tpl.name}" loaded with recommended ${tpl.channel.toUpperCase()} channel.`);
  };

  const handleSend = async () => {
    if (targetAudience === 'custom') {
      if (isEmail && parsedCustomEmails.length === 0) {
        toast.error('Recipient Email Required', 'Please enter at least one valid email address.');
        return;
      }
      if (!isEmail && parsedCustomNumbers.length === 0) {
        toast.error('Recipient Required', 'Please enter at least one valid 10-digit Indian mobile number.');
        return;
      }
    }

    if (!message.trim()) {
      toast.error('Message Content Required', 'Notice text cannot be empty.');
      return;
    }

    setIsSending(true);

    try {
      await new Promise((r) => setTimeout(r, 650));

      if (targetAudience === 'custom') {
        if (isEmail) {
          recordBatchDispatches(
            'timetable',
            'email',
            parsedCustomEmails.map((em, idx) => ({
              recipientName: customRecipientName.trim() || `Recipient ${idx + 1}`,
              recipientString: `${em}${customRecipientName.trim() ? ` (${customRecipientName.trim()})` : ''}`,
            })),
            {
              event_key: 'timetable.broadcast_notice',
              subject: subject.trim() || 'Timetable Schedule Notice',
              messageBody: previewText,
              status: 'sent',
            },
          );
        } else {
          recordBatchDispatches(
            'timetable',
            selectedChannel,
            parsedCustomNumbers.map((num, idx) => ({
              recipientName: customRecipientName.trim() || `Recipient ${idx + 1}`,
              mobileNumber: num,
            })),
            {
              event_key: 'timetable.broadcast_notice',
              subject: subject.trim() || 'Timetable Schedule Notice',
              messageBody: previewText,
              status: 'sent',
            },
          );
        }
      } else {
        activeRecipients.forEach((rec) => {
          recordDispatch({
            module: 'timetable',
            channel: selectedChannel,
            event_key: 'timetable.broadcast_notice',
            recipientName: rec.name,
            recipientString: isEmail
              ? `${rec.email} (${rec.name} - ${rec.role})`
              : `${rec.contact} (${rec.name} - ${rec.role})`,
            subject: subject.trim() || 'Timetable Schedule Notice',
            messageBody: message
              .replace(/\{recipient_name\}/g, rec.name)
              .replace(/\{class_name\}/g, rec.classOrSubject || 'Class 10-A')
              .replace(/\{period_no\}/g, '3')
              .replace(/\{room_no\}/g, 'Room 204')
              .replace(/\{student_name\}/g, rec.name),
            status: 'sent',
          });
        });
      }

      const total = activeRecipients.length;
      setSendSuccess(
        `Successfully broadcast notice via ${selectedChannel.toUpperCase()} to ${total} recipient${total > 1 ? 's' : ''}.`
      );

      toast.success(
        'Timetable Notice Dispatched',
        `Queued and delivered to ${total} recipient(s). Check the Delivery Log tab to view status.`
      );
    } catch {
      toast.error(
        'Delivery Failed',
        'Unable to deliver messages. Please check network connectivity.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const isDispatchDisabled =
    isSending ||
    (targetAudience === 'custom' && (isEmail ? parsedCustomEmails.length === 0 : parsedCustomNumbers.length === 0));

  return (
    <div className="space-y-6">
      {sendSuccess && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{sendSuccess}</p>
              <p className="text-xs text-emerald-700">Audit entry recorded in Delivery Log.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set('tab', 'delivery-log');
                router.push(url.pathname + url.search);
              }}
            >
              View Delivery Log
            </Button>
            <button
              onClick={() => setSendSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form Setup (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Step 1: Delivery Channel */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Delivery Channel
            </label>
            <div className="mt-2.5 grid grid-cols-3 gap-3">
              {[
                { id: 'whatsapp' as Channel, label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600' },
                { id: 'sms' as Channel, label: 'SMS Gateway', icon: MessageSquareText, color: 'text-indigo-600' },
                { id: 'email' as Channel, label: 'Email Digest', icon: Mail, color: 'text-blue-600' },
              ].map((ch) => {
                const Icon = ch.icon;
                const isSelected = selectedChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannel(ch.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3.5 text-sm font-semibold transition ${
                      isSelected
                        ? ch.id === 'email'
                          ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm ring-1 ring-blue-400'
                          : 'border-emerald-500 bg-emerald-50/50 text-emerald-900 shadow-sm ring-1 ring-emerald-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${ch.color}`} />
                    <span>{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Target Audience */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Target Recipients
            </label>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTargetAudience('custom')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  targetAudience === 'custom'
                    ? 'bg-[#5846EA] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isEmail ? 'Enter Custom Email Address' : 'Enter Custom Mobile Number'}
              </button>
              <button
                type="button"
                onClick={() => setTargetAudience('unregistered')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  targetAudience === 'unregistered'
                    ? 'bg-[#5846EA] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Faculty Proxy Duty Group (2)
              </button>
              <button
                type="button"
                onClick={() => setTargetAudience('all')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  targetAudience === 'all'
                    ? 'bg-[#5846EA] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Department Faculty (4)
              </button>
            </div>

            {targetAudience === 'custom' ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5">
                {isEmail ? (
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
                      <span>Recipient Email Address(es)</span>
                      <span className="text-blue-600 font-semibold">
                        {parsedCustomEmails.length} valid email(s) detected
                      </span>
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-blue-500" />
                      <Input
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="Enter email address(es)..."
                        className="pl-9 bg-white font-mono text-sm"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Enter valid email addresses. Multiple emails can be separated by comma or space.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
                      <span>Recipient Mobile Number(s)</span>
                      <span className="text-indigo-600 font-semibold">
                        {parsedCustomNumbers.length} valid number(s) detected
                      </span>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-indigo-500" />
                      <Input
                        value={customMobile}
                        onChange={(e) => setCustomMobile(e.target.value)}
                        placeholder="Enter 10-digit mobile number(s)..."
                        className="pl-9 bg-white font-mono text-sm"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Enter 10-digit Indian numbers. Multi-numbers can be separated by comma or space.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                    Recipient / Faculty Name (Replaces {'{recipient_name}'})
                  </label>
                  <Input
                    value={customRecipientName}
                    onChange={(e) => setCustomRecipientName(e.target.value)}
                    placeholder="Enter recipient or teacher/parent name..."
                    className="bg-white text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-semibold text-slate-700 mb-1">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span>Selected Group: {activeRecipients.length} Recipient(s)</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {activeRecipients.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1 rounded-md bg-white border px-2 py-0.5 text-xs text-slate-700">
                      {r.name} ({isEmail ? r.email : r.contact})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Message Content */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                <span>3. Notice Content & Subject</span>
                <span className="text-[11px] font-normal text-slate-400">Variables supported</span>
              </div>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject header..."
                className="bg-white text-sm font-medium"
              />
            </div>

            <div>
              <Textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your notice text here..."
                className="bg-white text-sm font-mono leading-relaxed"
              />
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-600">Dynamic Tags:</span>
                <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{'{recipient_name}'}</code>
                <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{'{class_name}'}</code>
                <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{'{period_no}'}</code>
                <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{'{room_no}'}</code>
              </div>
            </div>
          </div>

          {/* Dispatch Button */}
          <div className="pt-2">
            <Button
              onClick={handleSend}
              disabled={isDispatchDisabled}
              className="w-full h-11 bg-[#5846EA] hover:bg-[#4736d4] text-white font-semibold text-sm shadow-md"
            >
              {isSending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Dispatching Notice...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Broadcast Notice ({activeRecipients.length} Recipient{activeRecipients.length !== 1 ? 's' : ''})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column: Templates & Preview (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Preset Notice Templates */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Recommended Templates</span>
            </div>
            <div className="space-y-2">
              {TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl)}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3 hover:border-indigo-400 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">
                      {tpl.name}
                    </span>
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase">
                      {tpl.tag}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{tpl.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Live Phone Preview Card */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              <Eye className="h-4 w-4 text-indigo-500" />
              <span>Live Delivery Preview</span>
            </div>
            <Card className="border border-slate-200 shadow-sm bg-gradient-to-b from-slate-50 to-white">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <CalendarCheck2 className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Timetable Broadcast</span>
                  </div>
                  <span className={`text-[11px] font-medium uppercase ${isEmail ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {selectedChannel}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Subject</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{subject || '(No subject)'}</p>
                </div>

                <div className={`rounded-lg border p-3 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap ${
                  isEmail ? 'bg-blue-50/70 border-blue-100' : 'bg-emerald-50/70 border-emerald-100'
                }`}>
                  {previewText || '(Notice text preview will appear here)'}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Instant dispatch</span>
                  </div>
                  <span className="font-mono text-slate-500">
                    {activeRecipients.length > 0
                      ? isEmail
                        ? activeRecipients[0].email
                        : activeRecipients[0].contact
                      : isEmail
                        ? 'No email'
                        : 'No number'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
