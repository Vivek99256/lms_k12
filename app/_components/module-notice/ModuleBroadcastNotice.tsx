'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, MessageCircle, MessageSquareText, Phone, Send, Sparkles, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/result/toast';
import { dispatchCommunicationNotice } from '@/lib/communication/dispatch-store';

type Channel = 'sms' | 'whatsapp';

export interface NoticeTemplate {
  id: string;
  name: string;
  tag: string;
  subject: string;
  body: string;
}

export interface ModuleBroadcastNoticeProps {
  /** Dispatch-store module key; the Delivery log reads the same key. */
  moduleKey: string;
  eventKey: string;
  title: string;
  description: string;
  templates: NoticeTemplate[];
  /** Placeholder name -> label of the field asked for it, e.g. { name: 'Recipient name' }. */
  fields: Record<string, string>;
}

export function ModuleBroadcastNotice({ moduleKey, eventKey, title, description, templates, fields }: ModuleBroadcastNoticeProps) {
  const FIELDS = useMemo(() => Object.keys(fields), [fields]);
  const FIELD_LABELS = fields;
  const PLACEHOLDER = useMemo(() => new RegExp('\\{(' + FIELDS.join('|') + ')\\}', 'g'), [FIELDS]);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [numbersText, setNumbersText] = useState('');
  const [subject, setSubject] = useState(templates[0]?.subject ?? '');
  const [message, setMessage] = useState(templates[0]?.body ?? '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const numbers = useMemo(() => {
    const found: string[] = [];
    for (const token of numbersText.split(/[\n,; ]+/)) {
      const digits = token.replace(/\D/g, '');
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      if (/^[6-9]\d{9}$/.test(last10) && !found.includes(last10)) found.push(last10);
    }
    return found;
  }, [numbersText]);

  const usedFields = useMemo(() => {
    const used = new Set<string>();
    for (const m of message.matchAll(PLACEHOLDER)) used.add(m[1]);
    return FIELDS.filter((f) => used.has(f));
  }, [message, PLACEHOLDER, FIELDS]);

  const missingFields = usedFields.filter((f) => !(values[f] ?? '').trim());

  const rendered = useMemo(
    () => message.replace(PLACEHOLDER, (_, f: string) => (values[f] ?? '').trim() || `{${f}}`),
    [message, values, PLACEHOLDER],
  );

  const applyTemplate = (t: NoticeTemplate) => {
    setSubject(t.subject);
    setMessage(t.body);
    setResult(null);
  };

  const send = async () => {
    if (numbers.length === 0) {
      toast.error('Mobile number required', 'Enter at least one valid 10-digit mobile number.');
      return;
    }
    if (!message.trim()) {
      toast.error('Message required', 'Write a message or pick a template first.');
      return;
    }
    if (missingFields.length > 0) {
      toast.error('Fill in the details', `Please enter: ${missingFields.map((f) => FIELD_LABELS[f]).join(', ')}.`);
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const recipientName = (values.name ?? '').trim();
      const res = await dispatchCommunicationNotice({
        module: moduleKey,
        event_key: eventKey,
        channel,
        subject,
        message: rendered,
        recipients: numbers.map((n, i) => ({
          id: `n-${i}`,
          name: recipientName || 'Direct Recipient',
          phone: n,
          contact: n,
        })),
      });
      if (res.success) {
        setResult(`Notice sent to ${res.dispatchedCount} number(s) via ${channel === 'sms' ? 'SMS' : 'WhatsApp'}.`);
        toast.success('Notice sent', res.message);
      } else {
        toast.error('Notice not sent', res.errors[0] || res.message || 'The gateway did not accept the message.');
      }
    } catch (err) {
      toast.error('Notice not sent', err instanceof Error ? err.message : 'Unexpected error while sending.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">
          {description}
        </p>
      </div>

      {result && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="flex-1 text-sm">{result}</p>
          <button type="button" onClick={() => setResult(null)} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t)}
            className="group rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-[#5846EA] hover:shadow-sm"
          >
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{t.tag}</span>
            <h4 className="mt-2 text-sm font-semibold text-slate-900 group-hover:text-[#5846EA]">{t.name}</h4>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{t.body}</p>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[#5846EA]">
              <Sparkles className="h-3 w-3" />
              <span>Use this template</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="border-slate-200 shadow-sm lg:col-span-7">
          <CardContent className="space-y-5 p-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">1. Channel</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, on: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                  { key: 'sms', label: 'SMS', Icon: MessageSquareText, on: 'border-indigo-500 bg-indigo-50 text-indigo-800' },
                ] as const).map(({ key, label, Icon, on }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChannel(key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                      channel === key ? on : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">2. Mobile number(s)</label>
                <span className="text-[11px] text-slate-500">{numbers.length} valid number(s)</span>
              </div>
              <div className="relative mt-1.5">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={numbersText}
                  onChange={(e) => setNumbersText(e.target.value)}
                  placeholder="10-digit mobile number(s), separated by comma or space"
                  className="pl-9 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">3. Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5 text-sm" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">4. Message</label>
                <span className="text-[11px] text-slate-400">{rendered.length} characters</span>
              </div>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="mt-1.5 text-sm leading-relaxed" />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Insert:</span>
                {FIELDS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setMessage((prev) => `${prev} {${f}}`.trim())}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-[#5846EA] hover:text-[#5846EA]"
                  >
                    {`{${f}}`}
                  </button>
                ))}
              </div>
            </div>

            {usedFields.length > 0 && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 sm:grid-cols-3">
                {usedFields.map((f) => (
                  <div key={f}>
                    <label className="text-xs font-semibold text-indigo-950">{FIELD_LABELS[f]}</label>
                    <Input
                      value={values[f] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f]: e.target.value }))}
                      className="mt-1 bg-white text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            <Button onClick={send} disabled={sending} className="w-full bg-[#5846EA] py-2.5 font-semibold text-white shadow-sm hover:bg-[#4936d8]">
              {sending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  <span>Send notice ({numbers.length} number{numbers.length === 1 ? '' : 's'})</span>
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-b from-slate-50/50 to-white shadow-sm lg:col-span-5">
          <CardContent className="p-5">
            <h3 className="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-800">Preview</h3>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-800">{subject || 'No subject'}</p>
              <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                {rendered || 'Your message will appear here...'}
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                To: {numbers.length > 0 ? numbers.map((n) => `+91 ${n}`).join(', ') : 'no valid number entered yet'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
