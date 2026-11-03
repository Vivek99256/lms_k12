'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Info,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Phone,
  Search,
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
  normalizePhoneNumber,
  recordBatchDispatches,
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
  rollNo?: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'ptm-reminder',
    name: 'Parent-Teacher Meeting (PTM) Invitation',
    channel: 'whatsapp',
    subject: 'Parent-Teacher Meeting Invitation',
    body: 'Dear {parent_name}, you are cordially invited to attend the Parent-Teacher Meeting for {student_name} ({class_division}) on {date}. Your presence helps us support your child’s academic growth.',
    tag: 'PTM',
  },
  {
    id: 'report-card',
    name: 'Term Report Card & Progress Report',
    channel: 'sms',
    subject: 'Term Examination Report Card Published',
    body: 'Dear Parent, Term Progress Report for {student_name} ({class_division}, Roll {roll_no}) is now published and available on the Parent Portal. Please review your ward’s performance.',
    tag: 'Academic',
  },
  {
    id: 'discipline-advisory',
    name: 'Student Discipline & Uniform Advisory',
    channel: 'sms',
    subject: 'Student Uniform & Conduct Advisory',
    body: 'Dear Guardian, this is to inform you that {student_name} ({class_division}) was observed without proper school uniform today ({date}). Kindly ensure proper attire as per school guidelines.',
    tag: 'Discipline',
  },
  {
    id: 'holiday-circular',
    name: 'General Holiday Circular',
    channel: 'portal',
    subject: 'School Holiday Announcement',
    body: 'Dear Parents, please be informed that the school will remain closed on {date} on account of public holiday. Regular academic sessions will resume on the next working day.',
    tag: 'Circular',
  },
  {
    id: 'annual-event',
    name: 'Annual Day / Sports Meet Invitation',
    channel: 'email',
    subject: 'Invitation: Annual School Cultural Day Celebration',
    body: 'Dear Parents and Guardians,\n\nWe cordially invite you to celebrate the Annual School Day on {date}. Your child {student_name} is actively participating in the scheduled cultural performances.\n\nWarm regards,\nPrincipal & Faculty',
    tag: 'Events',
  },
];

const VARIABLE_TAGS = [
  { tag: '{student_name}', label: 'Student Name', example: 'Aarav Patel' },
  { tag: '{parent_name}', label: 'Parent Name', example: 'Rajesh Patel' },
  { tag: '{class_division}', label: 'Class / Section', example: 'Grade 10-A' },
  { tag: '{date}', label: 'Date', example: '05-Nov-2026' },
  { tag: '{roll_no}', label: 'Roll No', example: '14' },
];

const AUDIENCE_RECIPIENTS: Record<string, AudienceRecipient[]> = {
  all_students: [
    { id: '1', name: 'Aarav Patel', role: 'Grade 10-A (Roll 14)', contact: '+91 98250 12345', parentName: 'Mr. Rajesh Patel' },
    { id: '2', name: 'Rohan Sharma', role: 'Grade 10-A (Roll 08)', contact: '+91 98251 11223', parentName: 'Mr. Manoj Sharma' },
    { id: '3', name: 'Tanvi Joshi', role: 'Grade 8-B (Roll 19)', contact: '+91 97123 44556', parentName: 'Mrs. Hema Joshi' },
    { id: '4', name: 'Devansh Kothari', role: 'Grade 12-Sci (Roll 03)', contact: '+91 99099 77889', parentName: 'Dr. Sanjay Kothari' },
    { id: '5', name: 'Kavya Parekh', role: 'Grade 9-C (Roll 24)', contact: '+91 98982 33441', parentName: 'Mr. Pradeep Parekh' },
  ],
  class_10: [
    { id: '1', name: 'Aarav Patel', role: 'Grade 10-A (Roll 14)', contact: '+91 98250 12345', parentName: 'Mr. Rajesh Patel' },
    { id: '2', name: 'Rohan Sharma', role: 'Grade 10-A (Roll 08)', contact: '+91 98251 11223', parentName: 'Mr. Manoj Sharma' },
    { id: '6', name: 'Kabir Varma', role: 'Grade 10-B (Roll 12)', contact: '+91 98981 22334', parentName: 'Mr. Rakesh Varma' },
  ],
  class_12: [
    { id: '4', name: 'Devansh Kothari', role: 'Grade 12-Sci (Roll 03)', contact: '+91 99099 77889', parentName: 'Dr. Sanjay Kothari' },
    { id: '7', name: 'Nikhil Chauhan', role: 'Grade 12-Com (Roll 22)', contact: '+91 99887 66554', parentName: 'Mr. Bharat Chauhan' },
  ],
  new_admissions: [
    { id: '8', name: 'Diya Patel', role: 'Grade 1-A (Roll 05)', contact: '+91 99778 89911', parentName: 'Mr. Naresh Patel' },
    { id: '9', name: 'Yashwardhan Mehta', role: 'Grade 1-B (Roll 11)', contact: '+91 98255 12345', parentName: 'Mr. Ketan Mehta' },
  ],
};

const AUDIENCE_LABELS: Record<string, string> = {
  all_students: 'All Enrolled Students & Parents (General Announcement)',
  class_10: 'Grade 10 Board Students (Academic Circulars)',
  class_12: 'Grade 12 Senior Students (Examination & Career Notice)',
  new_admissions: 'Newly Enrolled Students & Families (Orientation)',
};

export function StudentBroadcastNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedChannel, setSelectedChannel] = useState<Channel>('sms');
  const [audienceMode, setAudienceMode] = useState<'preset' | 'custom'>('preset');
  const [audience, setAudience] = useState<string>('all_students');

  // Custom mobile recipient inputs
  const [customMobile, setCustomMobile] = useState('');
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [ccCustomMobileEnabled, setCcCustomMobileEnabled] = useState(false);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [lastSentBatch, setLastSentBatch] = useState<{
    count: number;
    audienceLabel: string;
    channel: string;
    time: string;
    firstPhone: string | null;
  } | null>(null);

  // Parse custom mobile numbers from comma/space separated input
  const parsedCustomNumbers = useMemo(() => {
    if (!customMobile.trim()) return [];
    const items = customMobile.split(/[,;\n]+/);
    return items
      .map((item) => normalizePhoneNumber(item.trim()))
      .filter((n) => n.replace(/\D/g, '').length >= 10);
  }, [customMobile]);

  const currentRecipients = useMemo(() => {
    return AUDIENCE_RECIPIENTS[audience] || [];
  }, [audience]);

  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return currentRecipients;
    const q = recipientSearch.toLowerCase();
    return currentRecipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.contact.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        (r.parentName && r.parentName.toLowerCase().includes(q)),
    );
  }, [currentRecipients, recipientSearch]);

  const goToDeliveryLog = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', 'delivery-log');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleSelectTemplate = (templateId: string) => {
    const tmpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    setSelectedChannel(tmpl.channel);
    setSubject(tmpl.subject);
    setBody(tmpl.body);
    toast.success('Template loaded', `Loaded template: ${tmpl.name}`);
  };

  const insertTag = (tag: string) => {
    setBody((prev) => prev + tag);
  };

  const getReplacedPreview = (text: string) => {
    let replaced = text;
    const resolvedName = customRecipientName.trim();
    if (resolvedName) {
      replaced = replaced.replaceAll('{student_name}', resolvedName);
      replaced = replaced.replaceAll('{parent_name}', resolvedName);
      replaced = replaced.replaceAll('{name}', resolvedName);
    }
    VARIABLE_TAGS.forEach((item) => {
      if (!resolvedName || item.tag !== '{student_name}') {
        replaced = replaced.replaceAll(item.tag, item.example);
      }
    });
    return replaced;
  };

  const handleSend = async () => {
    if (!body.trim()) {
      toast.error('Message required', 'Please write a message or choose a template.');
      return;
    }

    if (audienceMode === 'custom' && parsedCustomNumbers.length === 0) {
      toast.error('Mobile number required', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setSending(true);

    const channelLabel =
      selectedChannel === 'sms'
        ? 'SMS'
        : selectedChannel === 'whatsapp'
          ? 'WhatsApp'
          : selectedChannel === 'email'
            ? 'Email'
            : 'Web Portal Notice';

    const finalBody = getReplacedPreview(body);
    const itemsToRecord: Array<{
      recipientName?: string;
      mobileNumber?: string;
      recipientString?: string;
    }> = [];

    if (audienceMode === 'custom') {
      const recipientName = customRecipientName.trim() || 'Direct Recipient';
      parsedCustomNumbers.forEach((phone) => {
        itemsToRecord.push({
          recipientName: recipientName,
          mobileNumber: phone,
          recipientString: customRecipientName.trim()
            ? `${phone} (${customRecipientName.trim()})`
            : phone,
        });
      });
    } else {
      currentRecipients.forEach((r) => {
        itemsToRecord.push({
          recipientName: r.parentName || r.name,
          mobileNumber: r.contact,
          recipientString: `${r.contact} (${r.name} - ${r.role})`,
        });
      });

      if (ccCustomMobileEnabled && parsedCustomNumbers.length > 0) {
        parsedCustomNumbers.forEach((phone) => {
          itemsToRecord.push({
            recipientName: customRecipientName.trim() || 'Direct Copy',
            mobileNumber: phone,
            recipientString: `${phone} (Direct Copy)`,
          });
        });
      }
    }

    try {
      // Dispatches via Easy Com SMS or WhatsApp Gateway
      const dispatchResult = await dispatchCommunicationNotice({
        module: 'student',
        channel: selectedChannel,
        items: itemsToRecord,
        details: {
          event_key: audienceMode === 'custom' ? 'student.direct_notice' : `student.${audience}`,
          subject: subject || (selectedChannel === 'sms' ? 'Student SMS Notice' : 'Student Announcement'),
          messageBody: finalBody,
        },
      });

      const primaryPhone =
        parsedCustomNumbers[0] ||
        (itemsToRecord[0]?.mobileNumber ? itemsToRecord[0].mobileNumber : null);

      const audienceName =
        audienceMode === 'custom'
          ? `Direct Mobile (${parsedCustomNumbers.join(', ')})`
          : AUDIENCE_LABELS[audience] ?? audience;

      setLastSentBatch({
        count: itemsToRecord.length,
        audienceLabel: audienceName,
        channel: channelLabel,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        firstPhone: primaryPhone,
      });

      if (dispatchResult.success) {
        toast.success('Notice sent & logged', dispatchResult.message);
        if (audienceMode === 'custom') {
          setCustomMobile('');
          setCustomRecipientName('');
        }
      } else {
        toast.error('Gateway Notice', dispatchResult.message);
      }
    } catch (err: any) {
      toast.error('Send Error', err?.message || 'Failed to dispatch notice.');
    } finally {
      setSending(false);
    }
  };

  const charCount = body.length;
  const smsSegments = Math.max(1, Math.ceil(charCount / 160));

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#D9E3F1] pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Student Communication Dispatch</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Send real-time SMS, WhatsApp alerts, and Portal notices to students and guardians using the ERP Gateway.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToDeliveryLog}
            className="h-8 gap-1.5 text-xs border-[#D9E3F1] text-slate-700 hover:bg-slate-50"
          >
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            View Delivery Log
          </Button>
        </div>
      </div>

      {/* Success Banner if batch just sent */}
      {lastSentBatch && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">
                  Notice Dispatched to {lastSentBatch.count} Recipient(s)
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Delivered via <strong>{lastSentBatch.channel}</strong> to <em>{lastSentBatch.audienceLabel}</em> at{' '}
                  {lastSentBatch.time}.
                  {lastSentBatch.firstPhone && (
                    <span className="ml-2 font-mono font-bold text-emerald-900">
                      (Target: {lastSentBatch.firstPhone})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={goToDeliveryLog}
              className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-900 bg-white hover:bg-emerald-100"
            >
              Open Delivery Log →
            </Button>
          </div>
        </div>
      )}

      {/* Main Grid: Left Composition, Right Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Composer */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Channel Selector */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-4 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Select Delivery Channel
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'sms', label: 'SMS Gateway', icon: MessageSquareText, desc: 'Real SMS via Gateway' },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Meta Cloud API' },
                  { id: 'email', label: 'Email', icon: Mail, desc: 'SMTP Broadcast' },
                  { id: 'portal', label: 'Student Portal', icon: Calendar, desc: 'Web App Notice' },
                ].map((ch) => {
                  const Icon = ch.icon;
                  const isSel = selectedChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChannel(ch.id as Channel)}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                        isSel
                          ? 'border-[#5846EA] bg-[#F5F6FF] shadow-xs ring-1 ring-[#5846EA]'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`h-4 w-4 ${isSel ? 'text-[#5846EA]' : 'text-slate-500'}`} />
                        {isSel && <Check className="h-3.5 w-3.5 text-[#5846EA]" />}
                      </div>
                      <span className={`text-xs font-bold mt-2 ${isSel ? 'text-[#5846EA]' : 'text-slate-800'}`}>
                        {ch.label}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{ch.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 2. Target Audience & Custom Mobile Input */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Target Audience & Mobile Recipients
                </label>
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAudienceMode('preset')}
                    className={`rounded-lg px-3 py-1 font-medium transition ${
                      audienceMode === 'preset'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Class / Cohort Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode('custom')}
                    className={`rounded-lg px-3 py-1 font-medium transition flex items-center gap-1.5 ${
                      audienceMode === 'custom'
                        ? 'bg-[#5846EA] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Phone className="h-3 w-3" />
                    Enter Custom Mobile
                  </button>
                </div>
              </div>

              {audienceMode === 'custom' ? (
                /* Custom Mobile Input Panel */
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 animate-in fade-in space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                        Target Mobile Phone Number(s)
                      </span>
                      <span className="text-[11px] font-normal text-slate-500">
                        {parsedCustomNumbers.length > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            ✓ {parsedCustomNumbers.length} valid 10-digit number(s) detected
                          </span>
                        ) : (
                          'Enter 10-digit Indian phone'
                        )}
                      </span>
                    </label>
                    <Input
                      placeholder="Enter 10-digit mobile number(s)..."
                      value={customMobile}
                      onChange={(e) => setCustomMobile(e.target.value)}
                      className="mt-1.5 bg-white border-emerald-300 font-mono text-sm tracking-wide focus-visible:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Recipient / Student Name (Optional)
                    </label>
                    <Input
                      placeholder="Enter recipient or student name..."
                      value={customRecipientName}
                      onChange={(e) => setCustomRecipientName(e.target.value)}
                      className="mt-1 bg-white border-slate-200 text-xs"
                    />
                  </div>
                </div>
              ) : (
                /* Preset Audience Radio List */
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(AUDIENCE_LABELS).map(([key, label]) => {
                      const isSel = audience === key;
                      const count = AUDIENCE_RECIPIENTS[key]?.length || 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAudience(key)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-left transition ${
                            isSel
                              ? 'border-[#5846EA] bg-[#F5F6FF] font-medium text-[#5846EA]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-xs">{label}</span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* CC Custom Mobile Option */}
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="ccStudentMobile"
                        checked={ccCustomMobileEnabled}
                        onChange={(e) => setCcCustomMobileEnabled(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#5846EA] focus:ring-[#5846EA]"
                      />
                      <label htmlFor="ccStudentMobile" className="text-xs text-slate-700 font-medium cursor-pointer">
                        Also send a test copy to a specific mobile number
                      </label>
                    </div>
                    {ccCustomMobileEnabled && (
                      <Input
                        placeholder="Enter 10-digit mobile number"
                        value={customMobile}
                        onChange={(e) => setCustomMobile(e.target.value)}
                        className="h-8 w-44 bg-white text-xs font-mono"
                      />
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Notice Composition */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-4 space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Compose Message Content
              </label>

              {(selectedChannel === 'email' || selectedChannel === 'portal') && (
                <div>
                  <label className="text-xs font-medium text-slate-700">Subject / Header</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Annual Sports Day Schedule & Venue"
                    className="mt-1 border-[#D9E3F1] text-xs focus-visible:ring-[#5846EA]"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-700">Message Body</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message here, or pick a template from the right column..."
                  rows={5}
                  className="mt-1 border-[#D9E3F1] text-xs leading-relaxed focus-visible:ring-[#5846EA]"
                />
              </div>

              {/* Variable Tags */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500">Insert Dynamic Tags:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {VARIABLE_TAGS.map((vt) => (
                    <button
                      key={vt.tag}
                      type="button"
                      onClick={() => insertTag(vt.tag)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono text-slate-700 hover:border-[#5846EA] hover:bg-indigo-50 hover:text-[#5846EA]"
                    >
                      <Copy className="h-2.5 w-2.5 opacity-60" />
                      {vt.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-[11px] text-slate-400">
                  {charCount} characters · {selectedChannel === 'sms' ? `${smsSegments} SMS part(s)` : 'Direct delivery'}
                </span>
                <Button
                  onClick={handleSend}
                  disabled={sending}
                  className="h-9 gap-2 bg-[#5846EA] text-white hover:bg-[#4936d6] px-5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? 'Dispatching via Gateway…' : 'Queue & Send Notice'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Templates & Phone Preview */}
        <div className="lg:col-span-4 space-y-5">
          {/* Templates Library */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Notice Templates
              </span>
              <div className="space-y-2">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[#5846EA] hover:bg-indigo-50/30 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-[#5846EA]">
                        {tmpl.name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-600">
                        {tmpl.channel}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{tmpl.body}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Phone Preview */}
          <Card className="border-[#D9E3F1] shadow-sm bg-gradient-to-b from-slate-50 to-white">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  Mobile View Preview
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {selectedChannel.toUpperCase()}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-500">
                  <span>
                    To:{' '}
                    <strong>
                      {audienceMode === 'custom'
                        ? parsedCustomNumbers[0] || 'Direct Mobile'
                        : AUDIENCE_LABELS[audience] || audience}
                    </strong>
                  </span>
                  <span>Now</span>
                </div>

                {subject && (
                  <p className="text-xs font-bold text-slate-800 border-b border-slate-50 pb-1">
                    {subject}
                  </p>
                )}

                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {body.trim() ? (
                    getReplacedPreview(body)
                  ) : (
                    <span className="italic text-slate-400">
                      (Type your student notice or select a template above to see the live phone preview...)
                    </span>
                  )}
                </p>

                <div className="pt-2 text-right">
                  <span className="text-[10px] text-slate-400">From: School Administration</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

