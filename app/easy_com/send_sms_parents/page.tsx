'use client';
import { MessageSquareText } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'sms-parents', title: 'Send SMS Parents', description: 'Select students and send an SMS to parent mobile numbers.', icon: MessageSquareText, searchPath: 'easy_com/send_sms_parents/create', submitPath: 'easy_com/send_sms_parents', contactLabel: 'Mobile', messageLabel: 'SMS Text' }} />; }
