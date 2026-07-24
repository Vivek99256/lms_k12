'use client';
import { MessageCircleMore } from 'lucide-react';
import EntryPage from '../_components/EntryPage';
export default function Page() { return <EntryPage config={{ kind: 'whatsapp-parents', title: 'Send WhatsApp Parents', description: 'Send WhatsApp Cloud API messages to selected parents.', icon: MessageCircleMore, searchPath: 'whatsapp-send-messages/add', submitPath: 'whatsapp-send-messages/store', contactLabel: 'WhatsApp Mobile', messageLabel: 'WhatsApp Message' }} />; }
