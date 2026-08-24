'use client';
import { ChartNoAxesColumn } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'whatsapp', title: 'WhatsApp Report', description: 'Review sent WhatsApp messages, statuses, and replies.', icon: ChartNoAxesColumn, path: 'whatsapp-sent-generate-show-report', columns: [{ key: 'enrollment_no', label: 'GR No.' }, { key: 'student_name', label: 'Student Name' }, { key: 'whatsapp_number', label: 'Mobile Number' }, { key: 'created_by_name', label: 'Created By' }, { key: 'sent_date', label: 'Date' }, { key: 'message_status', label: 'Status' }, { key: 'message', label: 'Message' }] }} />; }
