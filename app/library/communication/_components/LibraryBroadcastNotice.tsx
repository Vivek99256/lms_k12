'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Eye,
  History,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  Search,
  Send,
  Sparkles,
  UserCheck,
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
  bookTitle?: string;
  accessionNo?: string;
  dueDate?: string;
  fineAmount?: number;
}

const TEMPLATES: Template[] = [
  {
    id: 'book-overdue',
    name: 'Urgent: Overdue Book Return Notice',
    channel: 'sms',
    subject: 'Urgent: Library Book Overdue',
    body: 'Dear {borrower_name}, the book "{book_title}" (Accession: {accession_no}) was due on {due_date}. Please return it immediately to avoid overdue fines. - School Library',
    tag: 'Overdue',
  },
  {
    id: 'book-due-soon',
    name: 'Reminder: Book Due Back Soon',
    channel: 'whatsapp',
    subject: 'Library Book Due Date Reminder',
    body: 'Hello {borrower_name}, this is a gentle reminder that your borrowed book "{book_title}" is due back on {due_date}. You can return or renew it at {return_counter}. Happy reading!',
    tag: 'Reminder',
  },
  {
    id: 'library-fine-advisory',
    name: 'Library Fine / Damage Charge Advisory',
    channel: 'email',
    subject: 'Library Account Statement: Outstanding Dues',
    body: 'Dear {borrower_name},\n\nThis is to notify you that an overdue/damage fine of Rs. {fine_amount} has been assessed for "{book_title}" (Accession: {accession_no}).\n\nPlease clear the balance at the Central Library counter before the term clearance deadline.\n\nThank you,\nLibrary Administration',
    tag: 'Fine',
  },
  {
    id: 'new-arrivals-circular',
    name: 'New Arrivals & Reference Books Circular',
    channel: 'portal',
    subject: 'New Library Arrivals This Month',
    body: 'Notice to all students and faculty: New titles including reference material, Olympiad guides, and classic literature have arrived in the library. Members are invited to inspect and borrow.',
    tag: 'New Books',
  },
  {
    id: 'clearance-reminder',
    name: 'Annual Library Clearance / No-Dues',
    channel: 'sms',
    subject: 'Library No-Dues Clearance Required',
    body: 'Dear {borrower_name}, annual library clearance is underway. Kindly return all borrowed books to {return_counter} by {due_date} to obtain your library no-dues slip.',
    tag: 'Clearance',
  },
];

const VARIABLE_TAGS = [
  { tag: '{borrower_name}', label: 'Borrower Name', example: 'Aarav Patel' },
  { tag: '{book_title}', label: 'Book Title', example: 'Concepts of Physics Vol 1' },
  { tag: '{accession_no}', label: 'Accession No', example: 'BK-2024-0412' },
  { tag: '{due_date}', label: 'Due Date', example: '31-Oct-2026' },
  { tag: '{fine_amount}', label: 'Fine Amount', example: '₹60' },
  { tag: '{return_counter}', label: 'Return Counter', example: 'Counter 2 (Ground Floor)' },
];

const AUDIENCE_RECIPIENTS: Record<string, AudienceRecipient[]> = {
  overdue_borrowers: [
    { id: '1', name: 'Aarav Patel', role: 'Grade 10-A (Roll 14)', contact: '+91 98980 12345', bookTitle: 'Concepts of Physics Vol 1', accessionNo: 'BK-2024-0412', dueDate: '25-Oct-2026', fineAmount: 60 },
    { id: '2', name: 'Riya Shah', role: 'Grade 8-B (Roll 22)', contact: '+91 97123 45678', bookTitle: 'To Kill a Mockingbird', accessionNo: 'BK-2023-1109', dueDate: '27-Oct-2026', fineAmount: 40 },
    { id: '3', name: 'Dev Joshi', role: 'Grade 9-C (Roll 07)', contact: '+91 99099 88112', bookTitle: 'Oxford Advanced Learner Dictionary', accessionNo: 'REF-2022-004', dueDate: '20-Oct-2026', fineAmount: 110 },
    { id: '4', name: 'Sneha Dave', role: 'Grade 11-Com (Roll 18)', contact: '+91 98241 22334', bookTitle: 'Accountancy Class XI', accessionNo: 'BK-2024-0988', dueDate: '26-Oct-2026', fineAmount: 50 },
    { id: '5', name: 'Kabir Varma', role: 'Grade 12-Sci (Roll 03)', contact: '+91 98790 55443', bookTitle: 'Organic Chemistry Reactions', accessionNo: 'BK-2024-0155', dueDate: '22-Oct-2026', fineAmount: 90 },
  ],
  due_soon_borrowers: [
    { id: '11', name: 'Manav Mehta', role: 'Grade 7-A (Roll 09)', contact: '+91 98251 66778', bookTitle: 'Harry Potter and the Goblet of Fire', accessionNo: 'BK-2021-0301', dueDate: '01-Nov-2026' },
    { id: '12', name: 'Pooja Trivedi', role: 'Grade 10-B (Roll 31)', contact: '+91 94280 99887', bookTitle: 'NCERT Exemplar Mathematics', accessionNo: 'BK-2024-0711', dueDate: '02-Nov-2026' },
    { id: '13', name: 'Kavya Parekh', role: 'Grade 9-A (Roll 15)', contact: '+91 98982 33441', bookTitle: 'A Brief History of Time', accessionNo: 'BK-2023-0499', dueDate: '02-Nov-2026' },
  ],
  fine_pending: [
    { id: '21', name: 'Dev Joshi', role: 'Grade 9-C (Roll 07)', contact: '+91 99099 88112', fineAmount: 110, bookTitle: 'Oxford Dictionary' },
    { id: '22', name: 'Aarav Patel', role: 'Grade 10-A (Roll 14)', contact: '+91 98980 12345', fineAmount: 60, bookTitle: 'Physics Vol 1' },
    { id: '23', name: 'Yashwardhan Chauhan', role: 'Grade 12-Com (Roll 27)', contact: '+91 98255 12345', fineAmount: 150, bookTitle: 'Business Studies Case Studies' },
  ],
  staff_borrowers: [
    { id: '31', name: 'Dr. Rajesh Mehta', role: 'Faculty - Physics HOD', contact: '+91 98250 12345', bookTitle: 'Feynman Lectures on Physics', accessionNo: 'REF-2019-012', dueDate: '15-Nov-2026' },
    { id: '32', name: 'Priya Sharma', role: 'Faculty - Mathematics', contact: '+91 98790 67890', bookTitle: 'Advanced Calculus', accessionNo: 'REF-2021-088', dueDate: '10-Nov-2026' },
    { id: '33', name: 'Sanjay Dave', role: 'Faculty - Social Studies', contact: '+91 97120 33445', bookTitle: 'India After Gandhi', accessionNo: 'BK-2020-0012', dueDate: '08-Nov-2026' },
  ],
  all_students: [
    { id: '41', name: 'All Enrolled Students (1,240 students)', role: 'Grade 1 to 12', contact: 'Student In-App Portal / SMS Gateway', bookTitle: 'General Catalogue Circulation' },
  ],
};

const AUDIENCE_LABELS: Record<string, string> = {
  overdue_borrowers: 'Borrowers with Overdue Books (Students & Staff)',
  due_soon_borrowers: 'Borrowers with Books Due Soon (Next 48 Hours)',
  fine_pending: 'Students with Outstanding Library Fines',
  staff_borrowers: 'Faculty & Staff Members with Issued Books',
  all_students: 'All Enrolled Students (Catalogue Announcements)',
};

export function LibraryBroadcastNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedChannel, setSelectedChannel] = useState<Channel>('sms');
  const [audienceMode, setAudienceMode] = useState<'preset' | 'custom'>('preset');
  const [audience, setAudience] = useState<string>('overdue_borrowers');

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

  const parsedCustomNumbers = useMemo(() => {
    if (!customMobile.trim()) return [];
    const items = customMobile.split(/[,;\n]+/);
    return items
      .map((item) => normalizePhoneNumber(item.trim()))
      .filter((n) => n.replace(/\D/g, '').length >= 10);
  }, [customMobile]);

  const currentRecipients = useMemo(() => {
    return AUDIENCE_RECIPIENTS[audience] ?? [];
  }, [audience]);

  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return currentRecipients;
    const q = recipientSearch.toLowerCase();
    return currentRecipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.contact.toLowerCase().includes(q) ||
        (r.bookTitle && r.bookTitle.toLowerCase().includes(q)),
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
      replaced = replaced.replaceAll('{borrower_name}', resolvedName);
      replaced = replaced.replaceAll('{student_name}', resolvedName);
      replaced = replaced.replaceAll('{name}', resolvedName);
    }
    VARIABLE_TAGS.forEach((item) => {
      if (!resolvedName || item.tag !== '{borrower_name}') {
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
      currentRecipients.forEach((r) => {
        itemsToRecord.push({
          recipientName: r.name,
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
      const dispatchResult = await dispatchCommunicationNotice({
        module: 'library',
        channel: selectedChannel,
        items: itemsToRecord,
        details: {
          event_key: audienceMode === 'custom' ? 'library.direct_notice' : `library.${audience}`,
          subject: subject || (selectedChannel === 'sms' ? 'Library Book Notice' : 'Library Notice'),
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
        toast.success('Library notice sent & logged', dispatchResult.message);
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
    <div className="space-y-4">
      {/* Top Banner / Quick Actions */}
      <div className="flex flex-col gap-2 rounded-2xl border border-[#D9E3F1] bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Send Library Notice & Reminders</h3>
          <p className="text-xs text-slate-500">
            Broadcast book overdue reminders, return deadlines, fine advisories, and direct mobile notices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {audienceMode === 'preset' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRecipientsModal(true)}
              className="h-8 gap-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50"
            >
              <Users className="h-3.5 w-3.5 text-[#5846EA]" />
              View Recipients ({currentRecipients.length})
            </Button>
          )}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left Column: Notice Configuration */}
        <div className="space-y-4 lg:col-span-2">
          {/* Step 1: Channel Selector */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Choose Delivery Channel
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    { key: 'sms', label: 'SMS Notice', icon: MessageSquareText, desc: 'Instant mobile gateway' },
                    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Official template' },
                    { key: 'email', label: 'Email Circular', icon: Mail, desc: 'Detailed slip' },
                    { key: 'portal', label: 'Student Portal', icon: Calendar, desc: 'In-app notice' },
                  ] as const
                ).map((ch) => {
                  const Icon = ch.icon;
                  const active = selectedChannel === ch.key;
                  return (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => setSelectedChannel(ch.key)}
                      className={`flex flex-col items-center justify-center rounded-2xl border p-3.5 text-center transition ${
                        active
                          ? 'border-[#5846EA] bg-indigo-50/40 text-[#5846EA] shadow-sm ring-1 ring-[#5846EA]'
                          : 'border-[#D9E3F1] bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`rounded-xl p-2 ${active ? 'bg-[#5846EA] text-white' : 'bg-slate-100 text-slate-600'}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="mt-2 text-xs font-bold">{ch.label}</span>
                      <span className="mt-0.5 text-[10px] text-slate-400">{ch.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Target Audience & Custom Mobile Input */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Target Library Audience
                </label>
                {audienceMode === 'preset' && (
                  <button
                    type="button"
                    onClick={() => setShowRecipientsModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5846EA] hover:underline"
                  >
                    <Users className="h-3.5 w-3.5" />
                    View Recipient List ({currentRecipients.length} members)
                  </button>
                )}
              </div>

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
                  Pre-defined Borrower Group
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
                      Borrower Name / Patron Note (Optional)
                    </label>
                    <Input
                      value={customRecipientName}
                      onChange={(e) => setCustomRecipientName(e.target.value)}
                      placeholder="Enter borrower / patron name..."
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
                <div className="mt-3 space-y-3">
                  <div>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="w-full rounded-xl border border-[#D9E3F1] bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#5846EA] focus:outline-none focus:ring-1 focus:ring-[#5846EA]"
                    >
                      <option value="overdue_borrowers">Borrowers with Overdue Books (Students & Staff)</option>
                      <option value="due_soon_borrowers">Borrowers with Books Due Soon (Next 48 Hours)</option>
                      <option value="fine_pending">Students with Outstanding Library Fines</option>
                      <option value="staff_borrowers">Faculty & Staff Members with Issued Books</option>
                      <option value="all_students">All Enrolled Students (Catalogue Announcements)</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      <span>
                        Currently <strong>{currentRecipients.length} members</strong> qualify for this audience.
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRecipientsModal(true)}
                      className="h-7 text-[11px] gap-1 px-2.5 border-[#5846EA]/30 text-[#5846EA] hover:bg-[#5846EA]/10"
                    >
                      <Eye className="h-3 w-3" />
                      View Recipients
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Message Content */}
          <Card className="border-[#D9E3F1] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  3. Compose Library Notice
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
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Overdue Library Book Reminder"
                    className="mt-1 h-9 border-[#D9E3F1] text-xs focus-visible:ring-[#5846EA]"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-700">Message Body</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your library notice here, or pick a template on the right to prefill..."
                  rows={5}
                  className="mt-1 border-[#D9E3F1] text-xs leading-relaxed focus-visible:ring-[#5846EA]"
                />
              </div>

              {/* Variable Tags */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500">Insert Variable Tags:</span>
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
                      Queue & Send Library Notice
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Templates & Preview */}
        <div className="space-y-4">
          {/* Templates Card */}
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
                  Borrower View Preview
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
                      (Type a message to see live preview here...)
                    </span>
                  )}
                </p>

                <div className="pt-2 text-right">
                  <span className="text-[10px] text-slate-400">From: School Central Library</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recipient Details Modal */}
      {showRecipientsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-[#D9E3F1] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Target Recipients List</h3>
                <p className="text-xs text-slate-500 mt-0.5">{AUDIENCE_LABELS[audience] || audience}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRecipientsModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search borrower by name, role, book..."
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  className="h-9 pl-9 text-xs border-[#D9E3F1]"
                />
              </div>
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
              {filteredRecipients.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No recipients found matching your search.
                </div>
              ) : (
                filteredRecipients.map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between p-3 hover:bg-slate-50 text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{rec.name}</p>
                      <p className="text-slate-500 text-[11px]">{rec.role}</p>
                      {rec.bookTitle && (
                        <p className="text-slate-400 text-[10px]">Book: {rec.bookTitle}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] block">
                        {rec.contact}
                      </span>
                      {rec.fineAmount !== undefined && (
                        <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                          Fine Due: ₹{rec.fineAmount}
                        </span>
                      )}
                      {rec.dueDate && (
                        <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                          Due: {rec.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Total <strong>{filteredRecipients.length}</strong> matching borrower(s)
              </span>
              <Button
                size="sm"
                onClick={() => setShowRecipientsModal(false)}
                className="h-8 text-xs font-semibold bg-[#5846EA] text-white hover:bg-[#4836d4]"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
