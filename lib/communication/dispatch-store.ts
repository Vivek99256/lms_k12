/**
 * Communication Dispatch Store & Phone Number Parser.
 *
 * Provides real-time persistence and synchronization between "Send notice"
 * and "Delivery log" screens across all communication modules (Attendance,
 * Library, Users, Admissions, Fees).
 *
 * Automatically parses, normalizes, and extracts mobile phone numbers from
 * recipients, stores live manual dispatches to localStorage, and emits
 * cross-component sync events.
 */

export interface StoredDispatchRow {
  id: number;
  module: string;
  event_key: string;
  channel: string;
  recipient: string;
  recipient_name: string;
  mobile_number: string | null;
  subject: string | null;
  message_body: string | null;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  is_sample: boolean | number;
}

const STORAGE_KEY = 'lms_communication_live_dispatches';
export const DISPATCH_UPDATED_EVENT = 'lms_dispatch_updated';

/**
 * Normalizes any phone number input into standardized format,
 * e.g., "9825111223" -> "+91 98251 11223".
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Strip spaces, dashes, parentheses
  const digits = trimmed.replace(/\D/g, '');

  // 10-digit Indian standard
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  // 12-digit with 91 prefix
  if (digits.length === 12 && digits.startsWith('91')) {
    const main = digits.slice(2);
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
  }
  // 11-digit starting with 0
  if (digits.length === 11 && digits.startsWith('0')) {
    const main = digits.slice(1);
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
  }

  // Already formatted or international with leading +
  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Extracts phone number and recipient name from strings like:
 * - "+91 98251 11223 (Mr. Manoj Sharma - F/O Rohan Sharma, Gr 10-A)"
 * - "9825111223"
 * - "Priya Dave (+91 98255 33441)"
 */
export function extractPhoneAndName(recipient: string): {
  phone: string | null;
  name: string;
} {
  if (!recipient || !recipient.trim()) {
    return { phone: null, name: 'Recipient' };
  }

  const raw = recipient.trim();

  // Pattern 1: Starts with Phone Number, name in parentheses e.g. "+91 98251 11223 (Mr. Manoj Sharma...)"
  const phoneFirstMatch = raw.match(/^([+\d\s-]{10,18})\s*(?:\(([^)]+)\))?/);
  if (phoneFirstMatch) {
    const phoneCandidate = phoneFirstMatch[1]?.trim();
    const cleanDigits = phoneCandidate?.replace(/\D/g, '') ?? '';
    if (cleanDigits.length >= 8) {
      const name = phoneFirstMatch[2]?.trim() || 'Direct Recipient';
      return {
        phone: normalizePhoneNumber(phoneCandidate),
        name,
      };
    }
  }

  // Pattern 2: Name first, phone in parentheses e.g. "Mr. Manoj Sharma (+91 98251 11223)"
  const nameFirstMatch = raw.match(/^([^(]+)\s*\(([+\d\s-]{10,18})\)/);
  if (nameFirstMatch) {
    const nameCandidate = nameFirstMatch[1]?.trim() || 'Recipient';
    const phoneCandidate = nameFirstMatch[2]?.trim();
    const cleanDigits = phoneCandidate?.replace(/\D/g, '') ?? '';
    if (cleanDigits.length >= 8) {
      return {
        phone: normalizePhoneNumber(phoneCandidate),
        name: nameCandidate,
      };
    }
  }

  // Pattern 3: String is just digits/phone
  const pureDigits = raw.replace(/\D/g, '');
  if (pureDigits.length >= 10 && pureDigits.length <= 13) {
    return {
      phone: normalizePhoneNumber(raw),
      name: 'Direct Recipient',
    };
  }

  // Fallback: check if any 10-digit number is contained anywhere in the text
  const phoneSearchMatch = raw.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
  if (phoneSearchMatch) {
    const foundPhone = phoneSearchMatch[0];
    const nameWithoutPhone = raw.replace(foundPhone, '').replace(/[()]/g, '').trim();
    return {
      phone: normalizePhoneNumber(foundPhone),
      name: nameWithoutPhone || 'Direct Recipient',
    };
  }

  return { phone: null, name: raw };
}

/**
 * Loads stored dispatches for a given module (or all modules).
 */
export function getStoredDispatches(moduleKey?: string): StoredDispatchRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: StoredDispatchRow[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (!moduleKey) return list;
    return list.filter((r) => r.module.toLowerCase() === moduleKey.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Records a newly sent dispatch message to localStorage and dispatches a sync event.
 */
export function recordDispatch(entry: {
  module: string;
  channel: string;
  event_key?: string;
  recipientName?: string;
  mobileNumber?: string;
  recipientString?: string;
  subject?: string | null;
  messageBody: string;
  status?: 'queued' | 'sent' | 'failed' | 'skipped';
  attempts?: number;
}): StoredDispatchRow {
  const normPhone = entry.mobileNumber ? normalizePhoneNumber(entry.mobileNumber) : null;
  const name = entry.recipientName?.trim() || (normPhone ? 'Direct Recipient' : 'Recipient');

  let fullRecipient = entry.recipientString?.trim();
  if (!fullRecipient) {
    if (normPhone && name && name !== 'Direct Recipient') {
      fullRecipient = `${normPhone} (${name})`;
    } else if (normPhone) {
      fullRecipient = normPhone;
    } else {
      fullRecipient = name;
    }
  }

  const now = new Date();
  const newRow: StoredDispatchRow = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    module: entry.module,
    event_key: entry.event_key || `${entry.module}.direct_notice`,
    channel: entry.channel,
    recipient: fullRecipient,
    recipient_name: name,
    mobile_number: normPhone,
    subject: entry.subject || null,
    message_body: entry.messageBody,
    status: entry.status || 'sent',
    attempts: entry.attempts ?? 1,
    last_error: null,
    sent_at: (entry.status ?? 'sent') === 'sent' ? now.toISOString() : null,
    created_at: now.toISOString(),
    is_sample: 0,
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredDispatches();
      // Keep up to 200 dispatches
      const updated = [newRow, ...existing].slice(0, 200);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT, { detail: newRow }));
    } catch {
      // storage unavailable
    }
  }

  return newRow;
}

/**
 * Records a batch of dispatches for multiple recipients or phone numbers.
 */
export function recordBatchDispatches(
  module: string,
  channel: string,
  items: Array<{
    recipientName?: string;
    mobileNumber?: string;
    recipientString?: string;
  }>,
  details: {
    event_key?: string;
    subject?: string | null;
    messageBody: string;
    status?: 'queued' | 'sent' | 'failed' | 'skipped';
  },
): StoredDispatchRow[] {
  const recorded: StoredDispatchRow[] = [];
  items.forEach((item) => {
    const row = recordDispatch({
      module,
      channel,
      event_key: details.event_key,
      recipientName: item.recipientName,
      mobileNumber: item.mobileNumber,
      recipientString: item.recipientString,
      subject: details.subject,
      messageBody: details.messageBody,
      status: details.status || 'sent',
    });
    recorded.push(row);
  });
  return recorded;
}


/**
 * Updates status and error/delivery time for a batch of dispatches by ID.
 */
export function updateDispatchesStatus(
  ids: number[],
  update: {
    status: 'queued' | 'sent' | 'failed' | 'skipped';
    last_error?: string | null;
  },
): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const existing = getStoredDispatches();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updated = existing.map((row) => {
      if (idSet.has(row.id)) {
        return {
          ...row,
          status: update.status,
          last_error: update.last_error !== undefined ? update.last_error : row.last_error,
          sent_at: update.status === 'sent' ? now : row.sent_at,
        };
      }
      return row;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT));
  } catch {
    // storage error
  }
}

/**
 * Deletes a single dispatch record by ID from localStorage and triggers a sync event.
 */
export function deleteStoredDispatch(id: number): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredDispatches();
    const updated = existing.filter((row) => row.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT));
  } catch {
    // storage error
  }
}

/**
 * Clears stored dispatches for a module or all dispatches.
 */
export function clearStoredDispatches(moduleKey?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!moduleKey) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      const existing = getStoredDispatches();
      const updated = existing.filter((row) => row.module.toLowerCase() !== moduleKey.toLowerCase());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    window.dispatchEvent(new CustomEvent(DISPATCH_UPDATED_EVENT));
  } catch {
    // storage error
  }
}

export interface DispatchNoticeParams {
  module: string;
  channel: string;
  items?: Array<{
    recipientName?: string;
    mobileNumber?: string;
    recipientString?: string;
  }>;
  details?: {
    event_key?: string;
    subject?: string | null;
    messageBody: string;
  };
  event_key?: string;
  subject?: string | null;
  message?: string;
  recipients?: Array<{
    id?: string;
    name?: string;
    phone?: string;
    contact?: string;
  }>;
}

export interface DispatchNoticeResult {
  success: boolean;
  message: string;
  dispatchedCount: number;
  errors: string[];
  dispatches: StoredDispatchRow[];
}

/**
 * Dispatches notices for any communication screen.
 * For SMS, it connects to the Easy Com gateway via /api/communication/send-sms.
 * For WhatsApp, it connects to Meta Cloud API via /api/communication/send-whatsapp.
 * Real gateway delivery/failure is reflected directly in localStorage and Delivery Log.
 */
export async function dispatchCommunicationNotice(params: DispatchNoticeParams): Promise<DispatchNoticeResult> {
  const { module, channel } = params;

  const items =
    params.items && params.items.length > 0
      ? params.items
      : (params.recipients || []).map((r) => ({
          recipientName: r.name || 'Direct Recipient',
          mobileNumber: r.phone || r.contact,
          recipientString: `${r.phone || r.contact} (${r.name || 'Recipient'})`,
        }));

  const details = params.details || {
    event_key: params.event_key || `${module}.direct_notice`,
    subject: params.subject || null,
    messageBody: params.message || '',
  };
  const channelLower = channel.toLowerCase();
  const isSms = channelLower === 'sms';
  const isWhatsapp = channelLower === 'whatsapp';
  const isGatewayChannel = isSms || isWhatsapp;

  // 1. Initial record (for SMS & WhatsApp start as queued so logs capture real progress)
  const rows = recordBatchDispatches(module, channel, items, {
    event_key: details.event_key,
    subject: details.subject,
    messageBody: details.messageBody,
    status: isGatewayChannel ? 'queued' : 'sent',
  });

  const rowIds = rows.map((r) => r.id);

  if (!isGatewayChannel) {
    return {
      success: true,
      message: `Dispatched to ${rows.length} recipient(s) via ${channel.toUpperCase()}.`,
      dispatchedCount: rows.length,
      errors: [],
      dispatches: rows,
    };
  }

  // 2. Collect phone numbers
  const phoneNumbers: string[] = [];
  items.forEach((item) => {
    if (item.mobileNumber) {
      phoneNumbers.push(item.mobileNumber);
    } else if (item.recipientString) {
      const parsed = extractPhoneAndName(item.recipientString);
      if (parsed.phone) phoneNumbers.push(parsed.phone);
    }
  });

  const gatewayLabel = isWhatsapp ? 'WhatsApp' : 'SMS';

  if (phoneNumbers.length === 0) {
    updateDispatchesStatus(rowIds, {
      status: 'failed',
      last_error: `No valid phone numbers found to dispatch ${gatewayLabel}.`,
    });
    return {
      success: false,
      message: `No valid phone numbers provided for ${gatewayLabel}.`,
      dispatchedCount: 0,
      errors: [`No valid phone numbers provided for ${gatewayLabel}.`],
      dispatches: rows,
    };
  }

  // 3. Resolve session context
  let token = '';
  let subInstituteId = '';
  let syear = '';
  let userId = '';
  if (typeof window !== 'undefined') {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || sessionStorage.getItem('userData') || '{}');
      token = userData.token || userData.user_token || '';
      subInstituteId = userData.sub_institute_id || localStorage.getItem('sub_institute_id') || '1';
      syear = userData.syear || localStorage.getItem('syear') || '';
      userId = userData.id || userData.user_id || '';
    } catch {
      // fallback
    }
  }

  const endpoint = isWhatsapp ? '/api/communication/send-whatsapp' : '/api/communication/send-sms';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        numbers: phoneNumbers,
        message: details.messageBody,
        module,
        subject: details.subject,
        sub_institute_id: subInstituteId,
        syear,
        user_id: userId,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      updateDispatchesStatus(rowIds, {
        status: 'sent',
        last_error: null,
      });
      return {
        success: true,
        message: data.message || `Dispatched to ${phoneNumbers.length} mobile number(s) via ${gatewayLabel} Gateway.`,
        dispatchedCount: phoneNumbers.length,
        errors: [],
        dispatches: rows,
      };
    } else {
      const errMsg = data?.message || `${gatewayLabel} Gateway refused dispatch. Check Easy Com API configuration.`;
      updateDispatchesStatus(rowIds, {
        status: 'failed',
        last_error: errMsg,
      });
      return {
        success: false,
        message: errMsg,
        dispatchedCount: 0,
        errors: [errMsg],
        dispatches: rows,
      };
    }
  } catch (err: any) {
    const errMsg = err?.message || `Network error communicating with ${gatewayLabel} gateway.`;
    updateDispatchesStatus(rowIds, {
      status: 'failed',
      last_error: errMsg,
    });
    return {
      success: false,
      message: errMsg,
      dispatchedCount: 0,
      errors: [errMsg],
      dispatches: rows,
    };
  }
}