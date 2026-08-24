'use client';
import { MailCheck } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'email', title: 'Email Report', description: 'Review emails sent to parents.', icon: MailCheck, path: 'easy_com/send_email_report', user: true, submit: true, columns: [{ key: 'EMAIL', label: 'Email' }, { key: 'SUBJECT', label: 'Subject' }, { key: 'EMAIL_TEXT', label: 'Message' }, { key: 'ATTACHMENT', label: 'Attachment' }, { key: 'created_at', label: 'Sent On' }, { key: 'user_name', label: 'Sent By' }] }} />; }
