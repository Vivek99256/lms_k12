'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, IdCard, Loader2, Printer, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionParams,
  asRecord,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { useAuth } from '@/contexts/AuthContext';

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type TeacherTypeOption = {
  id: string;
  label: string;
};

type TemplateOption = {
  value: string;
  label: string;
  sampleUrl: string;
};

type UserRow = {
  id: string;
  name: string;
};

type PreviewState = {
  html: string;
  template: string;
  row: number;
  column: number;
  selectedCount: number;
};

function normalizePayload(response: unknown): Record<string, unknown> {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (Object.keys(nested).length > 0) {
    return {
      ...root,
      ...nested,
      data: nested.data ?? root.data,
    };
  }

  return root;
}

function readStatus(payload: Record<string, unknown>): number {
  const rawStatus = payload.status ?? payload.status_code;
  return Number(readString(rawStatus)) || 0;
}

function readMessage(payload: Record<string, unknown>, fallback: string) {
  return readString(payload.message) || fallback;
}

function readStoredRecords() {
  if (typeof window === 'undefined') return [] as Array<Record<string, unknown>>;

  const storageKeys = ['userData', 'menuContext', 'sessionData', 'sessiondata', 'user_data', 'session', 'auth'];
  const records: Array<Record<string, unknown>> = [];

  for (const storage of [sessionStorage, localStorage]) {
    for (const key of storageKeys) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = asRecord(JSON.parse(raw));
        if (Object.keys(parsed).length > 0) {
          records.push(parsed);
        }
      } catch {
        continue;
      }
    }
  }

  return records;
}

function getNestedValue(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined;

  const record = source as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] != null && record[key] !== '') {
      return record[key];
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const nestedValue = getNestedValue(value, keys);
      if (nestedValue != null && nestedValue !== '') {
        return nestedValue;
      }
    }
  }

  return undefined;
}

function readFirstStoredValue(keys: string[]): string {
  const records = readStoredRecords();

  for (const record of records) {
    const value = readString(getNestedValue(record, keys));
    if (value) return value;
  }

  if (typeof window !== 'undefined') {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of keys) {
        const value = readString(storage.getItem(key));
        if (value) return value;
      }
    }
  }

  return '';
}

function resolveTeacherIcardSession(authContext?: {
  menuContext: {
    sub_institute_id: number;
    user_id: number;
    user_profile_name: string;
    user_profile_id: number;
    client_id: number;
  } | null;
}) {
  const helperSession = getFeesSession();
  const storedMenuContext = getStoredMenuContext();
  const menuContext = authContext?.menuContext ?? storedMenuContext;

  const token =
    helperSession.token ||
    readFirstStoredValue(['user_token', 'token']);
  const subInstituteId =
    helperSession.subInstituteId ||
    readString(menuContext?.sub_institute_id) ||
    readFirstStoredValue(['sub_institute_id', 'subInstituteId', 'subInstituteID']);
  const userId =
    helperSession.userId ||
    readString(menuContext?.user_id) ||
    readFirstStoredValue(['user_id', 'userId', 'id']);
  const userProfileId =
    helperSession.userProfileId ||
    readString(menuContext?.user_profile_id) ||
    readFirstStoredValue(['user_profile_id', 'userProfileId', 'profile_id', 'profileId']);
  const userProfileName =
    helperSession.userProfileName ||
    readString(menuContext?.user_profile_name) ||
    readFirstStoredValue(['user_profile_name', 'userProfileName', 'profile_name', 'profileName']);
  const clientId =
    helperSession.clientId ||
    readString(menuContext?.client_id) ||
    readFirstStoredValue(['client_id', 'clientId']);

  return {
    ...helperSession,
    token,
    subInstituteId,
    userId,
    userProfileId,
    userProfileName,
    clientId,
  };
}

function parseTeacherTypes(payload: Record<string, unknown>): TeacherTypeOption[] {
  const entries = Object.entries(asRecord(payload.teacher_types));
  return entries
    .map(([id, label]) => ({
      id: readString(id),
      label: readString(label),
    }))
    .filter((option) => option.id && option.label);
}

function parseTemplateOptions(payload: Record<string, unknown>): TemplateOption[] {
  return toArray(payload.templates)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        value: readString(record.value),
        label: readString(record.label),
        sampleUrl: readString(record.sample_url),
      };
    })
    .filter((template) => template.value && template.label);
}

function parseUserRows(payload: Record<string, unknown>): UserRow[] {
  const mappedData = asRecord(payload.data);
  const mappedRows = Object.entries(mappedData).map(([id, name]) => ({
    id: readString(id),
    name: readString(name),
  }));

  if (mappedRows.length > 0) {
    return mappedRows.filter((row) => row.id && row.name);
  }

  return toArray(payload.data)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: readString(record.id),
        name: readString(record.name),
      };
    })
    .filter((row) => row.id && row.name);
}

function openPrintWindow(title: string, html: string) {
  if (typeof window === 'undefined' || !html) {
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1300,height=900');
  if (!printWindow) {
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { margin: 0; padding: 16px; background: #ffffff; }
        </style>
      </head>
      <body onload="window.print()">${html}</body>
    </html>
  `);
  printWindow.document.close();
}

export default function TeacherIcardModule() {
  const { menuContext } = useAuth();
  const [teacherType, setTeacherType] = useState('');
  const [teacherTypes, setTeacherTypes] = useState<TeacherTypeOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [rowCount, setRowCount] = useState('1');
  const [columnCount, setColumnCount] = useState('1');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    let active = true;

    const loadMetadata = async () => {
      const session = resolveTeacherIcardSession({ menuContext });
      if (!session.subInstituteId) {
        setMessage({
          type: 'error',
          text: 'Session institute is missing. Please sign in again.',
        });
        return;
      }

      setMetadataLoading(true);
      setMessage(null);

      try {
        const params = new URLSearchParams({
          path: 'student/api/teacher_icard/metadata',
          type: 'API',
        });
        appendSessionParams(params, session);

        const response = await fetch(`/api/proxy?${params.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        const responseBody = await response.json();
        const payload = normalizePayload(responseBody);

        if (!response.ok || readStatus(payload) !== 1) {
          throw new Error(readMessage(payload, 'Unable to load User I-card metadata.'));
        }

        if (!active) {
          return;
        }

        const nextTeacherTypes = parseTeacherTypes(payload);
        const nextTemplates = parseTemplateOptions(payload);
        setTeacherTypes(nextTeacherTypes);
        setTemplates(nextTemplates);
        if (nextTemplates.length > 0) {
          setSelectedTemplate((current) => current || nextTemplates[0].value);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to load User I-card metadata.',
        });
      } finally {
        if (active) {
          setMetadataLoading(false);
        }
      }
    };

    void loadMetadata();

    return () => {
      active = false;
    };
  }, [menuContext]);

  const handleSearch = async () => {
    const session = resolveTeacherIcardSession({ menuContext });
    if (!session.subInstituteId) {
      setMessage({
        type: 'error',
        text: 'Session institute is missing. Please sign in again.',
      });
      return;
    }

    if (!teacherType) {
      setMessage({
        type: 'info',
        text: 'Select a type before searching users.',
      });
      return;
    }

    setSearchLoading(true);
    setMessage(null);
    setPreview(null);
    setSelectedUserIds([]);

    try {
      const params = new URLSearchParams({
        path: 'student/api/teacher_icard/search',
      });

      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('teacher_type', teacherType);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
      });

      const responseBody = await response.json();
      const payload = normalizePayload(responseBody);

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to fetch users for I-card generation.'));
      }

      const nextUsers = parseUserRows(payload);
      setUsers(nextUsers);

      setMessage({
        type: nextUsers.length > 0 ? 'success' : 'info',
        text: readMessage(payload, nextUsers.length > 0 ? 'Users loaded successfully.' : 'No users found.'),
      });
    } catch (error) {
      setUsers([]);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to fetch users for I-card generation.',
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedUserIds(checked ? users.map((user) => user.id) : []);
  };

  const handleToggleUser = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => (
      checked
        ? [...current, userId]
        : current.filter((value) => value !== userId)
    ));
  };

  const handlePreview = async () => {
    const session = resolveTeacherIcardSession({ menuContext });
    if (!session.subInstituteId) {
      setMessage({
        type: 'error',
        text: 'Session institute is missing. Please sign in again.',
      });
      return;
    }

    if (!selectedTemplate) {
      setMessage({
        type: 'info',
        text: 'Select a template before generating User I-cards.',
      });
      return;
    }

    if (selectedUserIds.length === 0) {
      setMessage({
        type: 'info',
        text: 'Select at least one user before generating User I-cards.',
      });
      return;
    }

    const parsedRowCount = Math.max(1, Number(rowCount) || 1);
    const parsedColumnCount = Math.max(1, Number(columnCount) || 1);

    setPreviewLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        path: 'student/api/teacher_icard/preview',
      });

      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('template', selectedTemplate);
      body.set('row', String(parsedRowCount));
      body.set('column', String(parsedColumnCount));
      selectedUserIds.forEach((userId) => body.append('users[]', userId));

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
      });

      const responseBody = await response.json();
      const payload = normalizePayload(responseBody);

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to generate User I-cards.'));
      }

      const html = readString(payload.html);
      if (!html) {
        throw new Error('User I-card preview HTML was not returned by Laravel.');
      }

      setPreview({
        html,
        template: readString(payload.template) || selectedTemplate,
        row: Number(payload.row) || parsedRowCount,
        column: Number(payload.column) || parsedColumnCount,
        selectedCount: Number(payload.selected_count) || selectedUserIds.length,
      });
      setMessage({
        type: 'success',
        text: readMessage(payload, 'User I-card preview generated successfully.'),
      });
    } catch (error) {
      setPreview(null);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to generate User I-cards.',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const allSelected = users.length > 0 && selectedUserIds.length === users.length;
  const selectedTemplateOption = useMemo(
    () => templates.find((template) => template.value === selectedTemplate) ?? null,
    [selectedTemplate, templates],
  );

  return (
    <PageFrame>
      <PageHeader
        title="User I-card"
        description="Mirror the legacy teacher or staff I-card workflow through the existing Next.js module patterns, without changing the old Laravel teacher I-card behavior."
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel
        title="Search Filters"
        description="Laravel only requires the user type for this module, then returns active users for that selected profile."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Type">
            <NativeSelect value={teacherType} onChange={setTeacherType} disabled={metadataLoading}>
              <option value="">{metadataLoading ? 'Loading types...' : 'Select type'}</option>
              {teacherTypes.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-end xl:col-span-3 xl:justify-end">
            <Button type="button" onClick={handleSearch} disabled={searchLoading}>
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="I-card Setup">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Template">
              <NativeSelect value={selectedTemplate} onChange={setSelectedTemplate} disabled={metadataLoading || templates.length === 0}>
                <option value="">{metadataLoading ? 'Loading templates...' : 'Select template'}</option>
                {templates.map((template) => (
                  <option key={template.value} value={template.value}>
                    {template.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Card Per Row">
              <Input
                type="number"
                min="1"
                value={rowCount}
                onChange={(event) => setRowCount(event.target.value)}
              />
            </Field>
            <Field label="Card Per Column">
              <Input
                type="number"
                min="1"
                value={columnCount}
                onChange={(event) => setColumnCount(event.target.value)}
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!selectedTemplateOption?.sampleUrl}
                onClick={() => {
                  if (selectedTemplateOption?.sampleUrl) {
                    window.open(selectedTemplateOption.sampleUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                <Eye className="h-4 w-4" />
                View Template
              </Button>
              <Button type="button" onClick={handlePreview} disabled={previewLoading || users.length === 0}>
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
                Generate
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead className="w-16 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all users"
                      checked={allSelected}
                      onChange={(event) => handleSelectAll(event.target.checked)}
                    />
                  </TableHead>
                  <TableHead>SR No.</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchLoading ? (
                  <LoadingRows colSpan={3} label="Loading users" />
                ) : users.length > 0 ? (
                  users.map((user, index) => (
                    <TableRow key={user.id} className="odd:bg-white even:bg-slate-50/60">
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.name}`}
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(event) => handleToggleUser(user.id, event.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-950">{user.name}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyTableRow colSpan={3} label="Search to load users for User I-card generation." />
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Preview"
        description="Laravel still owns the legacy User I-card HTML template rendering, and the Next.js frontend reuses that rendered output for preview and print."
        footer={(
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => openPrintWindow('User I-card Preview', preview?.html || '')}
              disabled={!preview}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      >
        {preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <span>Template: {preview.template}</span>
              <span>Cards per row: {preview.row}</span>
              <span>Cards per column: {preview.column}</span>
              <span>Selected users: {preview.selectedCount}</span>
            </div>

            <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div
                className="mx-auto min-w-[860px] bg-white p-4 shadow-sm"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-600">
            Generate User I-cards to preview the rendered Laravel template output here.
          </div>
        )}
      </SectionPanel>
    </PageFrame>
  );
}
