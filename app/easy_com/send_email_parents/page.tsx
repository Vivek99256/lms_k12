'use client';
import { Mail } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'email-parents', title: 'Send Email Parents', description: 'Compose an email for selected parent email addresses.', icon: Mail, searchPath: 'easy_com/send_email_parents/create', submitPath: 'easy_com/send_email_parents/send_email', contactLabel: 'Email', messageLabel: 'Email Content', email: true }} />; }
