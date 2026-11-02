'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  History,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  Send,
  Sparkles,
  Users,
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

const TEMPLATES: Template[] = [
  {
    id: 'staff-meeting',
    name: 'Staff Council Meeting Notice',
    channel: 'whatsapp',
    subject: 'Staff Council Meeting Notice',
    body: 'Dear {staff_name}, a mandatory staff council meeting is scheduled for {meeting_date} at {meeting_time} in {venue}. Kindly ensure punctual attendance.',
    tag: 'Meeting',
  },
  {
    id: 'id-card-ready',
    name: 'Staff Identity Card Ready',
    channel: 'sms',
    subject: 'Staff ID Card Ready for Collection',
    body: 'Dear {staff_name}, your new staff identity card for academic year {academic_year} is printed and ready. Please collect it from Admin Counter {venue}.',
    tag: 'ID Card',
  },
  {
    id: 'document-submission',
    name: 'Mandatory HR Document Reminder',
    channel: 'email',
    subject: 'Action Required: HR Service Record Verification',
    body: 'Dear {staff_name} ({designation}),\n\nOur HR records indicate that your updated service documents and qualification credentials remain unverified in the portal.\n\nPlease upload them before the end of this week.\n\nWarm regards,\nHuman Resources Office',
    tag: 'HR / Compliance',
  },
  {
    id: 'general-circular',
    name: 'Staff Circular / Holiday Advisory',
    channel: 'portal',
    subject: 'Institutional Holiday Advisory',
    body: 'Notice to all faculty and administrative staff: The institution will observe a local holiday on {meeting_date}. Regular academic schedules will resume the following working day.',
    tag: 'Circular',
  },
];

const VARIABLE_TAGS = [
  { tag: '{staff_name}', label: 'Staff Name', example: 'Dr. Rajesh Mehta' },
  { tag: '{designation}', label: 'Designation', example: 'Senior Lecturer' },
  { tag: '{department}', label: 'Department', example: 'Science' },
  { tag: '{meeting_date}', label: 'Date', example: '05-Nov-2026' },
  { tag: '{meeting_time}', label: 'Time', example: '03:30 PM' },
  { tag: '{venue}', label: 'Venue', example: 'Conference Hall B' },
  { tag: '{academic_year}', label: 'Year', example: '2026-27' },
];

export function UserBroadcastNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedChannel, setSelectedChannel] = useState<Channel>('sms');
  const [audienceMode, setAudienceMode] = useState<'preset' | 'custom'>('preset');
  const [audience, setAudience] = useState<string>('all_staff');
  const [department, setDepartment] = useState<string>('all');

  const [customMobile, setCustomMobile] = useState('');
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [ccCustomMobileEnabled, setCcCustomMobileEnabled] = useState(false);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [lastSentBatch, setLastSentBatch] = useState<{
    count: number;
    audienceLabel: string;
    channel: string;
    time: string;
    firstPhone: string | null;
  } | null>(null);

  const parsedCustomNumbers = useMemo(() => {
    if (!customMobile.trim()) return [];
    const items = customMobile.split(/[,;\n]+/);
    return items
      .map((item) => normalizePhoneNumber(item.trim()))
      .filter((n) => n.replace(/\D/g, '').length >= 10);
  }, [customMobile]);

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
      replaced = replaced.replaceAll('{staff_name}', resolvedName);
      replaced = replaced.replaceAll('{name}', resolvedName);
    }
    VARIABLE_TAGS.forEach((item) => {
      if (!resolvedName || item.tag !== '{staff_name}') {
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
      parsedCustomNumbers.forEach((phone) => {
        itemsToRecord.push({
          recipientName: customRecipientName.trim() || 'Direct Recipient',
          mobileNumber: phone,
          recipientString: customRecipientName.trim()
            ? `${phone} (${customRecipientName.trim()})`
            : phone,
        });
      });
    } else {
      const audLabel = audience.replace('_', ' ');
      itemsToRecord.push({
        recipientName: audLabel,
        mobileNumber: (ccCustomMobileEnabled && parsedCustomNumbers[0]) ? parsedCustomNumbers[0] : undefined,
        recipientString: `${audLabel} (Staff Broadcast)`,
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
      const dispatchResult = await dispatchCommunicationNotice({
        module: 'user',
        channel: selectedChannel,
        items: itemsToRecord,
        details: {
          event_key: audienceMode === 'custom' ? 'user.direct_notice' : `user.${audience}`,
          subject: subject || (selectedChannel === 'sms' ? 'Staff SMS Notice' : 'Staff Circular'),
          messageBody: finalBody,
        },
      });

      const primaryPhone =
        parsedCustomNumbers[0] ||
        (itemsToRecord[0]?.mobileNumber ? itemsToRecord[0].mobileNumber : null);

      const audienceName =
        audienceMode === 'custom'
          ? `Direct Mobile (${parsedCustomNumbers.join(', ')})`
          : audience.replace('_', ' ');

      setLastSentBatch({
        count: itemsToRecord.length,
        audienceLabel: audienceName,
        channel: channelLabel,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        firstPhone: primaryPhone,
      });

      if (dispatchResult.success) {
        toast.success('Staff notice sent & logged', dispatchResult.message);
        if (audienceMode === 'custom') {
          setCustomMobile('');
          setCustomRecipientName('');
        }
      } else {
        toast.error('SMS Gateway Refusal', dispatchResult.message);
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
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="rounded-2xl border border-[#D9E3F1] bg-gradient-to-r from-white via-indigo-50/20 to-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5846EA]/10 text-[#5846EA]">
                <Send className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">Broadcast Notice to Staff & Users</h2>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Send targeted SMS, WhatsApp alerts, official emails, or portal notices to faculty, staff members, or direct mobile numbers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={goToDeliveryLog}
              className="h-8 gap-1.5 bg-[#5846EA] text-xs font-semibold text-white hover:bg-[#4836d4]"
            >
              <History className="h-3.5 w-3.5" />
              View Delivery Log
            </Button>
          </div>
        </div>
      </div>

      {/* Post-send confirmation alert */}
      {lastSentBatch && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Notice sent successfully ({lastSentBatch.count} {lastSentBatch.count === 1 ? 'recipient' : 'recipients'} via {lastSentBatch.channel})
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Target: <strong>{lastSentBatch.audienceLabel}</strong> · Time: {lastSentBatch.time}.
                  {lastSentBatch.firstPhone && (
                    <span> Logged under mobile number: <span className="font-mono font-semibold">{lastSentBatch.firstPhone}</span>.</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={goToDeliveryLog}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 gap-1.5 shrink-0 shadow-sm"
            >
              <History className="h-3.5 w-3.5" />
              Open Delivery Log →
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Form & Composer */}
        <div className="space-y-4 lg:col-span-2">
          {/* Step 1: Channel Selector */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Select Delivery Channel
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { id: 'sms', label: 'SMS Text', icon: MessageSquareText, desc: 'Instant mobile gateway' },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Official template' },
                  { id: 'email', label: 'Email', icon: Mail, desc: 'Detailed circular' },
                  { id: 'portal', label: 'Staff Portal', icon: Bell, desc: 'In-app notification' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedChannel === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedChannel(item.id as Channel)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                        isSelected
                          ? 'border-[#5846EA] bg-[#5846EA]/5 ring-1 ring-[#5846EA]'
                          : 'border-[#D9E3F1] bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          isSelected ? 'bg-[#5846EA] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-bold text-slate-900">{item.label}</span>
                      <span className="text-[10px] text-slate-500">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Target Audience & Custom Mobile */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Target Staff Audience
              </label>

              {/* Mode Switcher */}
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAudienceMode('preset')}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${
                    audienceMode === 'preset'
                      ? 'bg-white text-[#5846EA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Staff Department Group
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceMode('custom')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${
                    audienceMode === 'custom'
                      ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Enter Custom Mobile Number
                </button>
              </div>

              {/* Custom Mobile Input */}
              {audienceMode === 'custom' ? (
                <div className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 animate-in fade-in">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                        Enter Mobile Number(s) <span className="text-rose-500">*</span>
                      </span>
                      {parsedCustomNumbers.length > 0 && (
                        <span className="text-[11px] font-semibold text-emerald-700">
                          {parsedCustomNumbers.length} valid {parsedCustomNumbers.length === 1 ? 'number' : 'numbers'} detected
                        </span>
                      )}
                    </label>
                    <Input
                      value={customMobile}
                      onChange={(e) => setCustomMobile(e.target.value)}
                      placeholder="Enter 10-digit mobile number(s)..."
                      className="mt-1 h-9 bg-white border-emerald-300 font-mono text-xs text-slate-900 focus-visible:ring-emerald-500 shadow-2xs"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Enter 10-digit mobile number. You can enter multiple numbers separated by commas.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700">
                      Staff Member Name or Note (Optional)
                    </label>
                    <Input
                      value={customRecipientName}
                      onChange={(e) => setCustomRecipientName(e.target.value)}
                      placeholder="Enter staff member name or role..."
                      className="mt-1 h-9 bg-white border-slate-200 text-xs shadow-2xs"
                    />
                  </div>

                  {parsedCustomNumbers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Target:
                      </span>
                      {parsedCustomNumbers.map((num) => (
                        <span
                          key={num}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-300 px-2 py-0.5 font-mono text-xs font-bold text-emerald-900 shadow-2xs"
                        >
                          <Phone className="h-3 w-3 text-emerald-600" />
                          {num}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-medium text-slate-700">Staff Category</span>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#D9E3F1] bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#5846EA] focus:outline-none focus:ring-1 focus:ring-[#5846EA]"
                    >
                      <option value="all_staff">All School Staff & Employees</option>
                      <option value="teachers">Teaching Staff (Teachers / Faculty)</option>
                      <option value="non_teaching">Non-Teaching & Support Staff</option>
                      <option value="admin_staff">Administration & Office Staff</option>
                      <option value="transport_staff">Transport & Bus Drivers</option>
                      <option value="id_card_pending">Staff with New ID Cards Ready</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-700">Department Filter</span>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#D9E3F1] bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#5846EA] focus:outline-none focus:ring-1 focus:ring-[#5846EA]"
                    >
                      <option value="all">All Departments</option>
                      <option value="science">Science Department</option>
                      <option value="mathematics">Mathematics Department</option>
                      <option value="languages">Languages & English</option>
                      <option value="social_science">Social Studies & Humanities</option>
                      <option value="sports">Physical Education & Sports</option>
                      <option value="accounts">Accounts & Finance</option>
                    </select>
                  </div>
                </div>
              )}

              {audienceMode === 'preset' && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ccCustomMobile"
                      checked={ccCustomMobileEnabled}
                      onChange={(e) => setCcCustomMobileEnabled(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#5846EA] focus:ring-[#5846EA]"
                    />
                    <label htmlFor="ccCustomMobile" className="text-xs text-slate-700 font-medium cursor-pointer">
                      Also send direct copy to Custom Mobile Number:
                    </label>
                  </div>
                  {ccCustomMobileEnabled && (
                    <Input
                      value={customMobile}
                      onChange={(e) => setCustomMobile(e.target.value)}
                      placeholder="Enter 10-digit mobile number"
                      className="h-8 text-xs font-mono max-w-[200px] bg-white border-slate-300"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Message Content */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  3. Compose Staff Message
                </label>
                {selectedChannel === 'sms' && (
                  <span className="text-[11px] font-medium text-slate-500">
                    {charCount} chars · {smsSegments} SMS {smsSegments === 1 ? 'part' : 'parts'}
                  </span>
                )}
              </div>

              {(selectedChannel === 'email' || selectedChannel === 'portal') && (
                <div>
                  <label className="text-xs font-medium text-slate-700">Subject / Circular Title</label>
                  <Input
                    placeholder="e.g. Staff Council Meeting Notification"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 border-[#D9E3F1] text-xs"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-700">Message Body</label>
                <Textarea
                  rows={5}
                  placeholder="Type your message here, or click a template on the right to pre-fill..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1 border-[#D9E3F1] text-xs leading-relaxed"
                />
              </div>

              {/* Variable Tags */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500">Insert Personalization Tags:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {VARIABLE_TAGS.map((vt) => (
                    <button
                      key={vt.tag}
                      type="button"
                      onClick={() => insertTag(vt.tag)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono text-slate-700 hover:border-[#5846EA] hover:bg-indigo-50 hover:text-[#5846EA]"
                      title={`Example: ${vt.example}`}
                    >
                      <Copy className="h-2.5 w-2.5 opacity-60" />
                      {vt.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBody('');
                    setSubject('');
                    setCustomMobile('');
                    setCustomRecipientName('');
                  }}
                  className="h-8 text-xs text-slate-500 hover:text-slate-700"
                >
                  Clear Form
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSend}
                  disabled={sending}
                  className="h-9 gap-2 bg-[#5846EA] px-5 text-xs font-semibold text-white hover:bg-[#4836d4] shadow-sm"
                >
                  {sending ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending Notice...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Queue & Send Staff Notice
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Templates & Preview */}
        <div className="space-y-4">
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Pre-approved Templates
                </span>
                <span className="text-[10px] text-slate-400">Click to use</span>
              </div>

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

          {/* Live Mobile Message Preview */}
          <Card className="border-[#D9E3F1] shadow-sm bg-gradient-to-b from-slate-50 to-white">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  Staff View Preview
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
                        : audience.replace('_', ' ')}
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
                      (Type a message to see live phone preview here...)
                    </span>
                  )}
                </p>

                <div className="pt-2 text-right">
                  <span className="text-[10px] text-slate-400">From: Principal & HR Administration</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
