'use client';
import { BellRing } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'notification-parents', title: 'Send Notification Parents', description: 'Send app notifications to selected parents.', icon: BellRing, searchPath: 'easy_com/send_notification_parents/create', submitPath: 'easy_com/send_notification_parents', contactLabel: 'Mobile', messageLabel: 'Notification Text' }} />; }
