'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  CheckCircle2,
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

type Channel = 'sms' | 'email' | 'whatsapp';

interface Template {
  id: string;
  name: string;
  channel: Channel;
  subject: string;
  body: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'enquiry_ack',
    name: 'Enquiry Acknowledgment',
    channel: 'sms',
    subject: 'Admission Enquiry Received',
    body: 'Dear {parent_name}, thank you for your enquiry for {applicant_name} for Grade {standard}. Your Enquiry No is {enquiry_no}. Our team will contact you shortly.',
  },
  {
    id: 'followup_reminder',
    name: 'Follow-up & Counseling Call',
    channel: 'whatsapp',
    subject: 'Admission Counseling Invitation',
    body: 'Hello {parent_name}, this is regarding your admission enquiry ({enquiry_no}) for {applicant_name}. We have scheduled a counseling session on {followup_date}. Kindly confirm your availability.',
  },
  {
    id: 'doc_pending',
    name: 'Pending Documents Chase',
    channel: 'email',
    subject: 'Action Required: Pending Documents for Admission Application',
    body: 'Dear {parent_name},\n\nWe have reviewed the admission registration for {applicant_name} ({enquiry_no}). Please submit the pending transfer certificate and previous marksheets at the earliest to proceed with verification.\n\nWarm regards,\nAdmissions Office',
  },
  {
    id: 'interview_slot',
    name: 'Interaction / Interview Scheduled',
    channel: 'sms',
    subject: 'Admission Interaction Slot Confirmed',
    body: 'Dear {parent_name}, interaction slot for {applicant_name} for Grade {standard} is confirmed for {followup_date}. Please carry original documents.',
  },
  {
    id: 'admission_offered',
    name: 'Provisional Admission Offer',
    channel: 'whatsapp',
    subject: 'Congratulations! Admission Offered',
    body: 'Congratulations {parent_name}! We are pleased to offer admission to {applicant_name} for Grade {standard}. Kindly complete fee payment by {followup_date} to confirm the seat.',
  },
];

const VARIABLE_TAGS = [
  { tag: '{applicant_name}', label: 'Applicant Name', example: 'Aarav Patel' },
  { tag: '{parent_name}', label: 'Parent Name', example: 'Rajesh Patel' },
  { tag: '{standard}', label: 'Standard / Grade', example: 'Grade 1' },
  { tag: '{enquiry_no}', label: 'Enquiry Number', example: 'ENQ-2026-0412' },
  { tag: '{followup_date}', label: 'Date', example: '05-Nov-2026' },
];

export function AdmissionBroadcastNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedChannel, setSelectedChannel] = useState<Channel>('sms');
  const [audienceMode, setAudienceMode] = useState<'preset' | 'custom'>('preset');
  const [audience, setAudience] = useState<string>('all_enquiries');

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
      replaced = replaced.replaceAll('{applicant_name}', resolvedName);
      replaced = replaced.replaceAll('{parent_name}', resolvedName);
      replaced = replaced.replaceAll('{name}', resolvedName);
    }
    VARIABLE_TAGS.forEach((item) => {
      if (!resolvedName || (item.tag !== '{applicant_name}' && item.tag !== '{parent_name}')) {
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
        recipientString: `${audLabel} (Admission Broadcast)`,
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
        module: 'admissions',
        channel: selectedChannel,
        items: itemsToRecord,
        details: {
          event_key: audienceMode === 'custom' ? 'admissions.direct_notice' : `admissions.${audience}`,
          subject: subject || (selectedChannel === 'sms' ? 'Admission SMS Update' : 'Admission Advisory'),
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
        toast.success('Admission notice sent & logged', dispatchResult.message);
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
      <div className="rounded-2xl border border-[#D9E3F1] bg-gradient-to-r from-white via-indigo-50/20 to-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Send Admission Notices & Broadcasts</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Dispatch SMS, Email or WhatsApp updates directly to applicant parents, enquiry leads, or custom mobile numbers.
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
        {/* Left column: Setup and composer */}
        <div className="space-y-4 lg:col-span-2">
          {/* Channel selector */}
          <Card className="border-[#D9E3F1] bg-white shadow-sm">
            <CardContent className="p-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                1. Select Communication Channel
              </label>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChannel('sms')}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition ${
                    selectedChannel === 'sms'
                      ? 'border-[#5846EA] bg-[#EEF0FF] text-[#5846EA] shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <MessageSquareText className="h-5 w-5" />
                  <span className="text-xs font-bold">SMS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('whatsapp')}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition ${
                    selectedChannel === 'whatsapp'
                      ? 'border-[#22C55E] bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs font-bold">WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel('email')}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition ${
                    selectedChannel === 'email'
                      ? 'border-[#5846EA] bg-[#EEF0FF] text-[#5846EA] shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Mail className="h-5 w-5" />
                  <span className="text-xs font-bold">Email</span>
                </button>
              </div>

              {/* Target Audience & Custom Mobile */}
              <div className="mt-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  2. Target Audience
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
                    Applicant Pipeline Group
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
                        Applicant Parent Name or Lead Note (Optional)
                      </label>
                      <Input
                        value={customRecipientName}
                        onChange={(e) => setCustomRecipientName(e.target.value)}
                        placeholder="Enter applicant / parent name..."
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
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { id: 'all_enquiries', label: 'All Active Enquiries', count: '49 leads' },
                      { id: 'pending_followup', label: 'Overdue Follow-ups', count: '14 leads' },
                      { id: 'open_applications', label: 'Open Registration Forms', count: '18 applicants' },
                      { id: 'confirmed_admissions', label: 'Confirmed Admissions', count: '25 students' },
                    ].map((aud) => (
                      <label
                        key={aud.id}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition ${
                          audience === aud.id
                            ? 'border-[#5846EA] bg-[#F5F6FF] font-semibold text-[#5846EA]'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="audience"
                            value={aud.id}
                            checked={audience === aud.id}
                            onChange={(e) => setAudience(e.target.value)}
                            className="h-3.5 w-3.5 text-[#5846EA]"
                          />
                          <span>{aud.label}</span>
                        </div>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                          {aud.count}
                        </span>
                      </label>
                    ))}
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
              </div>
            </CardContent>
          </Card>

          {/* Composer */}
          <Card className="border-[#D9E3F1] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  3. Compose Message
                </label>
                <span className="text-xs text-slate-400">
                  {selectedChannel === 'sms' && `${charCount} chars (${smsSegments} SMS)`}
                </span>
              </div>

              {selectedChannel === 'email' && (
                <div className="mt-3">
                  <Input
                    placeholder="Email Subject Line"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9 rounded-xl border-slate-200 text-sm"
                  />
                </div>
              )}

              <div className="mt-3">
                <Textarea
                  placeholder={`Type your ${selectedChannel.toUpperCase()} notice here... Use tags below for personalization.`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={selectedChannel === 'email' ? 7 : 5}
                  className="rounded-xl border-slate-200 text-sm leading-relaxed"
                />
              </div>

              {/* Tag inserters */}
              <div className="mt-3">
                <span className="text-[11px] font-semibold text-slate-400">Insert Personalization Tags:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {VARIABLE_TAGS.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertTag(v.tag)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-[#5846EA] hover:bg-[#EEF0FF] hover:text-[#5846EA]"
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={handleSend}
                  disabled={sending || !body.trim()}
                  className="h-9 gap-2 rounded-xl bg-[#5846EA] px-5 text-xs font-semibold text-white shadow-sm hover:bg-[#4936d8]"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? 'Sending...' : 'Queue & Send Admission Notice'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Templates & Live Phone Preview */}
        <div className="space-y-4">
          <Card className="border-[#D9E3F1] bg-white shadow-sm">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Admission Templates
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

          {/* Live Mobile Message Preview */}
          <Card className="border-[#D9E3F1] shadow-sm bg-gradient-to-b from-slate-50 to-white">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  Parent View Preview
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
                  <span className="text-[10px] text-slate-400">From: School Admission Office</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
