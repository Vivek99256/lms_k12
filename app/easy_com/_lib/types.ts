import type { LucideIcon } from 'lucide-react';

export type JsonRecord = Record<string, unknown>;

<<<<<<< HEAD
export type EntryKind = 'sms-parents' | 'sms-staff' | 'notification-parents' | 'whatsapp-parents' | 'email-parents';
export type ReportKind = 'email' | 'sms' | 'register-parent' | 'whatsapp' | 'notification';
export type MasterKind = 'sms-api' | 'whatsapp-api' | 'smtp';

export interface Recipient {
  id: string;
=======
export type EntryKind =
  | 'sms-parents'
  | 'sms-staff'
  | 'notification-parents'
  | 'whatsapp-parents'
  | 'email-parents';

export type ReportKind = 'email' | 'sms' | 'register-parent' | 'whatsapp' | 'notification';

export type MasterKind = 'sms-api' | 'whatsapp-api' | 'smtp';

/** A row in the recipient picker, normalised across all five send screens. */
export interface Recipient {
  /** Value posted as the selection key - a mobile/email for most screens, a student id for WhatsApp. */
  key: string;
  studentId: string;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
  searchPath: string;
  submitPath: string;
  contactLabel: string;
  messageLabel: string;
  staff?: boolean;
  email?: boolean;
=======
  /** GET path (relative to /api/easy_com) returning { stu_data: [...] }. */
  recipientsPath: string;
  /** POST path (relative to /api/easy_com) that dispatches the message. */
  sendPath: string;
  /** Request field the message body is posted under. */
  messageField: string;
  /** Request field the selection map is posted under. */
  selectionField: 'sendsms' | 'sendNotification';
  /** What the selection map is keyed by. */
  selectionKey: 'contact' | 'studentId';
  contactLabel: string;
  messageLabel: string;
  messageMaxLength?: number;
  /** Staff screens pick a profile group instead of an academic class. */
  staff?: boolean;
  /** Email screens add subject + attachment and validate email addresses. */
  email?: boolean;
  /** Screens offering the admission-year filter. */
  academicYear?: boolean;
  /** Show the standard/division columns in the recipient table. */
  showClassColumns?: boolean;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}

export interface ReportColumn {
  key: string;
  label: string;
<<<<<<< HEAD
=======
  /** Render long free text in a wrapped, width-capped cell. */
  wide?: boolean;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}

export interface ReportConfig {
  kind: ReportKind;
  title: string;
  description: string;
  icon: LucideIcon;
<<<<<<< HEAD
  path: string;
  columns: ReportColumn[];
  academic?: boolean;
  mobile?: boolean;
  user?: boolean;
  submit?: boolean;
=======
  /** GET path relative to /api/easy_com. */
  path: string;
  /** GET path for filter dropdown data, when the screen has any. */
  optionsPath?: string;
  columns: ReportColumn[];
  /** Academic section / standard / division filter. */
  academic?: boolean;
  /** Mobile-number filter. */
  mobile?: boolean;
  /** Sender dropdown (Email report). */
  users?: boolean;
  /** Academic-year dropdown. */
  academicYear?: boolean;
  /** Parents / staff source toggle (SMS report). */
  source?: boolean;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}

export interface MasterField {
  key: string;
  label: string;
  type?: 'text' | 'password' | 'number' | 'email';
  required?: boolean;
<<<<<<< HEAD
=======
  /** Full-width in the two-column form grid. */
  wide?: boolean;
  helpText?: string;
  /**
   * Secret fields are pre-filled with a mask on edit; leaving the mask in place
   * keeps the stored credential instead of overwriting it. The API never
   * returns the credential itself, only the boolean flag named here
   * (e.g. `has_password`, `has_access_token`).
   */
  secret?: boolean;
  secretFlag?: string;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}

export interface MasterConfig {
  kind: MasterKind;
  title: string;
  description: string;
  icon: LucideIcon;
<<<<<<< HEAD
  path: string;
  fields: MasterField[];
  columns: ReportColumn[];
  createPath?: string;
  testEmail?: boolean;
=======
  /** Collection path relative to /api/easy_com; item paths append /{id}. */
  path: string;
  fields: MasterField[];
  columns: ReportColumn[];
  /** SMTP exposes a "send test email" panel. */
  testPath?: string;
  /** Only one configuration per institute is meaningful. */
  singleton?: boolean;
  entityLabel: string;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}
