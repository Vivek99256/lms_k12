'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, ScanFace, UserCheck, UserX, X } from 'lucide-react';

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
  asRecord,
  getFeesSession,
  readString,
  toArray,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';

const MIN_IMAGES = 3;
const MAX_IMAGES = 5;

type MessageState = { type: 'success' | 'error' | 'info'; text: string };
type AttendanceCode = 'P' | 'A';
type ClassOption = { value: string; label: string };

type StudentRow = {
  id: string;
  enrollmentNo: string;
  rollNo: string;
  firstName: string;
  middleName: string;
  lastName: string;
};

type CaptureResult = {
  date: string;
  standardDivision: string;
  students: StudentRow[];
};

type PhotoSlot = { key: string; file: File; url: string };

function authHeaders(session: FeesSession): HeadersInit {
  return {
    Accept: 'application/json',
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

/** Laravel answers `{ status, message, data }`; failures may add `errors`. */
async function readEnvelope(response: Response): Promise<{ ok: boolean; message: string; data: unknown }> {
  let body: Record<string, unknown> = {};
  try {
    body = asRecord(await response.json());
  } catch {
    body = {};
  }
  return {
    ok: response.ok && Number(body.status) === 1,
    message: readString(body.message),
    data: body.data,
  };
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isSunday(value: string) {
  return Boolean(value) && new Date(`${value}T00:00:00`).getDay() === 0;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseClasses(value: unknown): ClassOption[] {
  return toArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      return { value: readString(record.value), label: readString(record.label) };
    })
    .filter((option) => option.value && option.label);
}

function parseStudents(value: unknown): StudentRow[] {
  return toArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      return {
        id: readString(record.id),
        enrollmentNo: readString(record.enrollment_no),
        rollNo: readString(record.roll_no),
        firstName: readString(record.first_name),
        middleName: readString(record.middle_name),
        lastName: readString(record.last_name),
      };
    })
    .filter((student) => student.id);
}

function parseAttendance(value: unknown): Record<string, AttendanceCode> {
  const result: Record<string, AttendanceCode> = {};
  Object.entries(asRecord(value)).forEach(([studentId, code]) => {
    const normalized = readString(code).toUpperCase();
    if (normalized === 'P' || normalized === 'A') result[studentId] = normalized;
  });
  return result;
}

export default function ClassFaceAttendancePage() {
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [standardDivision, setStandardDivision] = useState('');
  const [date, setDate] = useState('');
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceCode>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef<PhotoSlot[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  useEffect(() => {
    let cancelled = false;

    const loadClasses = async () => {
      const session = getFeesSession();
      if (!session.token || !session.subInstituteId) {
        setMessage({ type: 'error', text: 'Your session has expired. Sign in again.' });
        setLoadingClasses(false);
        return;
      }

      try {
        const params = new URLSearchParams({ path: 'api/face-attendance/class-options' });
        if (session.academicYearId) params.set('syear', session.academicYearId);
        const response = await fetch(`/api/proxy?${params.toString()}`, {
          headers: authHeaders(session),
          cache: 'no-store',
        });
        const envelope = await readEnvelope(response);
        if (!envelope.ok) throw new Error(envelope.message || "Couldn't load your classes. Try again.");
        if (cancelled) return;

        const options = parseClasses(envelope.data);
        setClasses(options);
        if (options.length === 0) {
          setMessage({ type: 'info', text: 'No classes are assigned to you, so there is no attendance to take.' });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't load your classes. Try again." });
        }
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    };

    void loadClasses();
    return () => {
      cancelled = true;
    };
  }, []);

  const presentCount = useMemo(() => Object.values(attendance).filter((code) => code === 'P').length, [attendance]);
  const absentCount = useMemo(() => Object.values(attendance).filter((code) => code === 'A').length, [attendance]);

  const handleFilesPicked = (fileList: FileList | null) => {
    if (!fileList) return;
    const picked = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    const room = MAX_IMAGES - photos.length;

    if (picked.length < fileList.length) {
      setMessage({ type: 'error', text: 'Only image files can be uploaded.' });
    } else if (picked.length > room) {
      setMessage({ type: 'info', text: `You can upload at most ${MAX_IMAGES} images. Extra files were ignored.` });
    }

    const added = picked.slice(0, Math.max(room, 0)).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotos((current) => [...current, ...added]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const removePhoto = (key: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((photo) => photo.key !== key);
    });
  };

  const handleCapture = async () => {
    const session = getFeesSession();

    if (!standardDivision || !date) {
      setMessage({ type: 'info', text: 'Select a standard/division and a date first.' });
      return;
    }
    if (isSunday(date)) {
      setMessage({ type: 'error', text: "Sunday is a holiday, so attendance can't be taken on that day." });
      setDate('');
      return;
    }
    if (photos.length < MIN_IMAGES) {
      setMessage({ type: 'info', text: `Upload at least ${MIN_IMAGES} class photos (you have ${photos.length}).` });
      return;
    }

    setCapturing(true);
    setMessage(null);

    try {
      const form = new FormData();
      form.set('standard_division', standardDivision);
      form.set('date', date);
      if (session.academicYearId) form.set('syear', session.academicYearId);
      photos.forEach((photo) => form.append('images[]', photo.file, photo.file.name));

      const response = await fetch('/api/proxy-file?path=api/face-attendance/capture', {
        method: 'POST',
        headers: authHeaders(session),
        body: form,
      });
      const envelope = await readEnvelope(response);
      if (!envelope.ok) throw new Error(envelope.message || "Couldn't match faces. Try again.");

      const data = asRecord(envelope.data);
      const students = parseStudents(data.student_data);
      setResult({
        date: readString(data.date) || date,
        standardDivision: readString(data.standard_division) || standardDivision,
        students,
      });
      setAttendance(parseAttendance(data.attendance_data));
      setMessage({ type: 'success', text: envelope.message || 'Faces matched. Review the list and save.' });
    } catch (error) {
      setResult(null);
      setAttendance({});
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't match faces. Try again." });
    } finally {
      setCapturing(false);
    }
  };

  const handleSave = async () => {
    const session = getFeesSession();
    if (!result || result.students.length === 0) return;

    setSaving(true);
    setMessage(null);

    try {
      const body = new URLSearchParams();
      body.set('standard_division', result.standardDivision);
      body.set('date', result.date);
      if (session.academicYearId) body.set('syear', session.academicYearId);
      result.students.forEach((student) => body.set(`student[${student.id}]`, attendance[student.id] ?? 'P'));

      const response = await fetch('/api/proxy?path=api/face-attendance/save', {
        method: 'POST',
        headers: { ...authHeaders(session), 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });
      const envelope = await readEnvelope(response);
      if (!envelope.ok) throw new Error(envelope.message || "Couldn't save attendance. Try again.");

      setMessage({ type: 'success', text: envelope.message || 'Attendance saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't save attendance. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const markAll = (code: AttendanceCode) => {
    if (!result) return;
    setAttendance(Object.fromEntries(result.students.map((student) => [student.id, code])));
  };

  const busy = capturing || saving;

  return (
    <PageFrame>
      <PageHeader
        title="Capture class attendance"
        description="Upload class photos and let face matching suggest who is present, then review and save."
        action={
          result ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => markAll('P')} disabled={busy}>
                <UserCheck className="h-4 w-4" />
                Mark all present
              </Button>
              <Button type="button" variant="outline" onClick={() => markAll('A')} disabled={busy}>
                <UserX className="h-4 w-4" />
                Mark all absent
              </Button>
              <Button type="button" onClick={handleSave} disabled={busy}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save attendance
              </Button>
            </div>
          ) : undefined
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel
        title="Class photos"
        description={`Choose the class and date, then add ${MIN_IMAGES} to ${MAX_IMAGES} photos that show the students' faces.`}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Standard and division">
            <NativeSelect value={standardDivision} onChange={setStandardDivision} disabled={loadingClasses || busy}>
              <option value="">{loadingClasses ? 'Loading classes...' : 'Select standard and division'}</option>
              {classes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Date">
            <Input
              type="date"
              max={todayIso()}
              value={date}
              disabled={busy}
              onChange={(event) => {
                if (isSunday(event.target.value)) {
                  setMessage({ type: 'error', text: "Sunday is a holiday, so attendance can't be taken on that day." });
                  setDate('');
                  return;
                }
                setDate(event.target.value);
              }}
            />
          </Field>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Photos ({photos.length} of {MAX_IMAGES}, minimum {MIN_IMAGES})
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((photo, index) => (
              <div key={photo.key} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Class photo ${index + 1}`} className="h-32 w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => removePhoto(photo.key)}
                  disabled={busy}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="truncate px-2 py-1 text-xs text-slate-600">{photo.file.name}</div>
              </div>
            ))}
            {photos.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ImagePlus className="h-5 w-5" />
                Add photos
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => handleFilesPicked(event.target.files)}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={handleCapture} disabled={busy || loadingClasses}>
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
            {capturing ? 'Matching faces...' : 'Match faces'}
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Register"
        description="Students whose face was not matched are suggested as absent. Correct anything before saving."
      >
        {result && (
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-700">
            <span>Total students: <strong className="text-slate-950">{result.students.length}</strong></span>
            <span>Present: <strong className="text-emerald-700">{presentCount}</strong></span>
            <span>Absent: <strong className="text-rose-700">{absentCount}</strong></span>
            <span>Date: <strong className="text-slate-950">{formatDate(result.date)}</strong></span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead>No.</TableHead>
                <TableHead>GR no.</TableHead>
                <TableHead>Roll no.</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Absent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capturing ? (
                <LoadingRows colSpan={6} label="Matching faces" />
              ) : result && result.students.length > 0 ? (
                result.students.map((student, index) => (
                  <TableRow key={student.id} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{student.enrollmentNo || '-'}</TableCell>
                    <TableCell>{student.rollNo || '-'}</TableCell>
                    <TableCell className="font-medium text-slate-950">
                      {[student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ') || '-'}
                    </TableCell>
                    {(['P', 'A'] as const).map((code) => (
                      <TableCell key={code} className="text-center">
                        <input
                          type="radio"
                          name={`student-${student.id}`}
                          aria-label={`${code === 'P' ? 'Present' : 'Absent'}: ${student.firstName} ${student.lastName}`.trim()}
                          checked={(attendance[student.id] ?? 'P') === code}
                          onChange={() => setAttendance((current) => ({ ...current, [student.id]: code }))}
                          disabled={saving}
                          className={`h-4 w-4 ${code === 'P' ? 'accent-emerald-600' : 'accent-rose-600'}`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow colSpan={6} label="Match faces to load the suggested register." />
              )}
            </TableBody>
          </Table>
        </div>

        {result && (
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={handleSave} disabled={busy}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save attendance
            </Button>
          </div>
        )}
      </SectionPanel>
    </PageFrame>
  );
}
