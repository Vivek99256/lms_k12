import type { LucideIcon } from 'lucide-react';

export type JsonRecord = Record<string, unknown>;

export type EntryKind = 'sms-parents' | 'sms-staff' | 'notification-parents' | 'whatsapp-parents' | 'email-parents';
export type ReportKind = 'email' | 'sms' | 'register-parent' | 'whatsapp' | 'notification';
export type MasterKind = 'sms-api' | 'whatsapp-api' | 'smtp';

export interface Recipient {
  id: string;
  name: string;
  enrollment: string;
  standard: string;
  division: string;
  contact: string;
  eligible: boolean;
}

export interface EntryConfig {
  kind: EntryKind;
  title: string;
  description: string;
  icon: LucideIcon;
  searchPath: string;
  submitPath: string;
  contactLabel: string;
  messageLabel: string;
  staff?: boolean;
  email?: boolean;
}

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportConfig {
  kind: ReportKind;
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  columns: ReportColumn[];
  academic?: boolean;
  mobile?: boolean;
  user?: boolean;
  submit?: boolean;
}

export interface MasterField {
  key: string;
  label: string;
  type?: 'text' | 'password' | 'number' | 'email';
  required?: boolean;
}

export interface MasterConfig {
  kind: MasterKind;
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  fields: MasterField[];
  columns: ReportColumn[];
  createPath?: string;
  testEmail?: boolean;
}
