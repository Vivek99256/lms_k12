'use client';
import { MessagesSquare } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'sms-staff', title: 'Send SMS Staff', description: 'Select a staff group and send an SMS to active staff.', icon: MessagesSquare, searchPath: 'easy_com/send_sms_staff/create', submitPath: 'easy_com/send_sms_staff', contactLabel: 'Mobile', messageLabel: 'SMS Text', staff: true }} />; }
