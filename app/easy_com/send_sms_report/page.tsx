'use client';
import { FileText } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'sms', title: 'Send SMS Report', description: 'Review parent and staff SMS delivery logs.', icon: FileText, path: 'easy_com/send_sms_report', academic: true, columns: [{ key: 'name', label: 'Name' }, { key: 'SMS_NO', label: 'Mobile' }, { key: 'SMS_TEXT', label: 'SMS Text' }, { key: 'MODULE_NAME', label: 'Source' }, { key: 'created_on', label: 'Sent On' }] }} />; }
