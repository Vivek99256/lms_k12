'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
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
  dispatchCommunicationNotice,
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
  parentName?: string;
  subject?: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'homework-alert',
    name: 'Daily Homework & Assignment Reminder',
    channel: 'whatsapp',
    subject: 'Homework & Assignment Advisory',
    body: 'Dear {parent_name}, Mathematics homework (Chapter 5: Quadratic Equations, Ex 5.2) has been assigned to {student_name} ({class_division}) and is due tomorrow morning. Please ensure timely submission.',
    tag: 'Homework',
  },
  {
    id: 'unit-test-syllabus',
    name: 'Unit Test / Exam Syllabus Notification',
    channel: 'whatsapp',
    subject: 'Unit Test 2 Syllabus & Schedule',
    body: 'Dear {parent_name}, Unit Test 2 for Science is scheduled on 08-Nov-2026 for {student_name}. Chapters: Light, Electricity, Magnetic Effects. Study materials are available on Scholar LMS.',
    tag: 'Test Alert',
  },
  {
    id: 'academic-feedback',
    name: 'Teacher Academic Progress Feedback',
    channel: 'sms',
    subject: 'Subject Teacher Academic Feedback',
    body: 'Dear {parent_name}, Science teacher remarks for {student_name}: Excellent active participation in lab experiments. Keep up the consistent effort.',
    tag: 'Feedback',
  },
  {
    id: 'project-submission',
    name: 'Term Project / Practical Submission Due',
    channel: 'sms',
    subject: 'Term Practical Project Submission Reminder',
    body: 'Dear Parent, submission deadline for {student_name}’s Social Studies Term Project is 12-Nov-2026. Kindly ensure project portfolio is signed and submitted.',
    tag: 'Project',
  },
];

const PRESET_AUDIENCE: AudienceRecipient[] = [
  { id: '1', name: 'Aarav Patel', role: 'Student (Grade 10-A)', contact: '+91 98250 12345', parentName: 'Rajesh Patel', subject: 'Mathematics' },
  { id: '2', name: 'Diya Shah', role: 'Student (Grade 10-A)', contact: '+91 98251 12345', parentName: 'Nitin Shah', subject: 'Science' },
  { id: '3', name: 'Rohan Mehta', role: 'Student (Grade 10-B)', contact: '+91 98795 67890', parentName: 'Ramesh Mehta', subject: 'English' },
  { id: '4', name: 'Priya Joshi', role: 'Student (Grade 9-A)', contact: '+91 97243 54321', parentName: 'Bhavin Joshi', subject: 'Social Science' },
];

export function TeachLearnBroadcastNotice() {
  const router = useRouter();

  const [selectedChannel, setSelectedChannel] = useState<Channel>('whatsapp');
  const [targetAudience, setTargetAudience] = useState<'all' | 'class' | 'custom'>('custom');
  const [selectedClass, setSelectedClass] = useState('Grade 10-A');
  const [customMobile, setCustomMobile] = useState('');
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [message, setMessage] = useState(TEMPLATES[0].body);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const parsedCustomNumbers = useMemo(() => {
    if (targetAudience !== 'custom') return [];
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
  }, [customMobile, targetAudience]);

  const activeRecipients: AudienceRecipient[] = useMemo(() => {
    if (targetAudience === 'custom') {
      if (parsedCustomNumbers.length === 0) return [];
      return parsedCustomNumbers.map((num, idx) => ({
        id: `custom-${idx}`,
        name: customRecipientName.trim() || `Recipient ${idx + 1}`,
        role: 'Direct Custom Recipient',
        contact: `+91 ${num}`,
        parentName: customRecipientName.trim() || undefined,
        subject: 'Academics',
      }));
    }
    if (targetAudience === 'class') {
      return PRESET_AUDIENCE.filter((r) => r.role.includes(selectedClass.split(' ')[1] || '10'));
    }
    return PRESET_AUDIENCE;
  }, [targetAudience, selectedClass, parsedCustomNumbers, customRecipientName]);

  const handleApplyTemplate = (tmpl: Template) => {
    setSelectedChannel(tmpl.channel);
    setSubject(tmpl.subject);
    setMessage(tmpl.body);
    toast.success('Template loaded', `Loaded "${tmpl.name}" with recommended ${tmpl.channel.toUpperCase()} channel.`);
  };

  const handleInsertVariable = (v: string) => {
    setMessage((prev) => `${prev} ${v}`);
  };

  const getReplacedPreview = (text: string) => {
    const student = activeRecipients[0] || { name: 'Aarav Patel' };
    const customName = customRecipientName.trim();
    const effectiveParent = customName || 'Parent';
    const effectiveStudent = customName || student.name || 'Student';

    return text
      .replace(/{student_name}/g, effectiveStudent)
      .replace(/{parent_name}/g, effectiveParent)
      .replace(/{name}/g, effectiveParent)
      .replace(/{class_division}/g, selectedClass)
      .replace(/{subject}/g, 'Mathematics')
      .replace(/{submission_date}/g, 'Tomorrow, 08:30 AM');
  };

  const handleSendNotice = async () => {
    if (targetAudience === 'custom' && parsedCustomNumbers.length === 0) {
      toast.error('Valid Mobile Number Required', 'Please enter at least one valid 10-digit Indian mobile number.');
      return;
    }

    if (!message.trim()) {
      toast.error('Message Content Required', 'Please write a message body or select a template before sending.');
      return;
    }

    setIsSending(true);
    setSendSuccess(null);

    try {
      const recipientList = activeRecipients.map((r) => {
        const rawDigits = r.contact.replace(/\D/g, '');
        const phone10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
        return {
          id: r.id,
          name: r.name,
          phone: phone10,
          contact: r.contact,
        };
      });

      const effectiveMessage = getReplacedPreview(message);

      const result = await dispatchCommunicationNotice({
        module: 'teach-learn',
        event_key: 'teach_learn.academic_notice',
        channel: selectedChannel,
        subject,
        message: effectiveMessage,
        recipients: recipientList,
      });

      if (result.success) {
        setSendSuccess(
          `Notice broadcasted to ${result.dispatchedCount} recipient(s) via ${selectedChannel.toUpperCase()} successfully!`
        );
        toast.success('Academic Notice Dispatched', `Dispatched ${result.dispatchedCount} notification(s) via gateway.`);
      } else {
        toast.error('Dispatch Partial / Error', result.errors[0] || 'Unable to deliver to some recipients.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown communication gateway failure';
      toast.error('Dispatch Error', msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Send Teach/Learn Academic Notices & Updates
          </h1>
          <p className="text-sm text-slate-500">
            Broadcast daily homework assignments, syllabus updates, unit test advisories, and teacher feedback via SMS & WhatsApp.
          </p>
        </div>
      </div>

      {sendSuccess && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 shadow-sm animate-in fade-in duration-300">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-emerald-950">Academic Notice Dispatched Successfully</p>
            <p className="mt-0.5 text-emerald-800">{sendSuccess}</p>
          </div>
          <button
            onClick={() => setSendSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Quick Academic Notice Templates
          </label>
          <span className="text-xs text-slate-400">Click any template to auto-populate</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tmpl)}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-[#5846EA] hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                    {tmpl.tag}
                  </span>
                  <span className="text-[11px] font-medium uppercase text-slate-400">
                    {tmpl.channel}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-semibold text-slate-900 group-hover:text-[#5846EA]">
                  {tmpl.name}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 leading-relaxed">
                  {tmpl.body}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[#5846EA]">
                <Sparkles className="h-3 w-3" />
                <span>Use this template</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  1. Delivery Channel
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedChannel('whatsapp')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      selectedChannel === 'whatsapp'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChannel('sms')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      selectedChannel === 'sms'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquareText className="h-4 w-4 text-indigo-600" />
                    <span>SMS Gateway</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChannel('email')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      selectedChannel === 'email'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span>Email Digest</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  2. Target Class / Audience
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAudience('custom')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      targetAudience === 'custom'
                        ? 'bg-[#5846EA] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Enter Custom Mobile Number
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAudience('class')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      targetAudience === 'class'
                        ? 'bg-[#5846EA] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Specific Class (Grade 10-A)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAudience('all')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      targetAudience === 'all'
                        ? 'bg-[#5846EA] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Enrolled Students (4)
                  </button>
                </div>

                {targetAudience === 'custom' ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-indigo-950">
                          Recipient Mobile Number(s)
                        </label>
                        <span className="text-[11px] text-indigo-600">
                          {parsedCustomNumbers.length} valid number(s) detected
                        </span>
                      </div>
                      <div className="relative mt-1.5">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-indigo-400" />
                        <Input
                          value={customMobile}
                          onChange={(e) => setCustomMobile(e.target.value)}
                          placeholder="Enter 10-digit mobile number(s)..."
                          className="pl-9 font-mono text-sm bg-white"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Enter 10-digit Indian numbers. Multi-numbers can be separated by comma or space.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-indigo-950">
                        Recipient / Parent Name (Replaces {'{parent_name}'} and {'{student_name}'})
                      </label>
                      <Input
                        value={customRecipientName}
                        onChange={(e) => setCustomRecipientName(e.target.value)}
                        placeholder="Enter recipient or parent name..."
                        className="mt-1 text-sm bg-white"
                      />
                    </div>
                  </div>
                ) : targetAudience === 'class' ? (
                  <div className="mt-3">
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="Grade 10-A">Grade 10-A (2 Students)</option>
                      <option value="Grade 10-B">Grade 10-B (1 Student)</option>
                      <option value="Grade 9-A">Grade 9-A (1 Student)</option>
                    </select>
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  3. Subject / Header
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter notice subject"
                  className="mt-1.5 text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    4. Message Body
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {message.length} characters (approx. {Math.ceil(message.length / 160)} SMS parts)
                  </span>
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Type your academic notice or assignment instructions here..."
                  className="mt-1.5 text-sm leading-relaxed"
                />

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Dynamic tags:</span>
                  {[
                    '{parent_name}',
                    '{student_name}',
                    '{class_division}',
                    '{subject}',
                    '{submission_date}',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertVariable(tag)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-[#5846EA] hover:text-[#5846EA]"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSendNotice}
                  disabled={isSending || activeRecipients.length === 0}
                  className="w-full bg-[#5846EA] hover:bg-[#4936d8] text-white py-2.5 font-semibold shadow-sm"
                >
                  {isSending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Broadcasting Academic Notice...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      <span>
                        Send Notice Now ({activeRecipients.length} Recipient
                        {activeRecipients.length === 1 ? '' : 's'})
                      </span>
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card className="border-slate-200 shadow-sm bg-gradient-to-b from-slate-50/50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#5846EA]" />
                  <h3 className="text-sm font-semibold text-slate-800">Live Recipient Preview</h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                  {selectedChannel}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700 text-sm">
                    {customRecipientName ? customRecipientName.charAt(0) : 'T'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {customRecipientName || 'Parent / Student Guardian'}
                    </p>
                    <p className="font-mono text-[11px] text-emerald-600">
                      {activeRecipients[0]?.contact || '+91 98250 12345'}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-800">{subject}</p>
                  <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {getReplacedPreview(message) || 'Your message will appear here...'}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Sender: Teach/Learn Academic Staff</span>
                  <span>Just now</span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-xs font-semibold text-slate-700">Recipients in Batch:</p>
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {activeRecipients.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-xs border border-slate-100"
                    >
                      <div className="truncate">
                        <span className="font-medium text-slate-800">{rec.name}</span>
                        <span className="ml-1 text-[11px] text-slate-400">({rec.role})</span>
                      </div>
                      <span className="font-mono text-[11px] text-emerald-600 font-medium">
                        {rec.contact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

