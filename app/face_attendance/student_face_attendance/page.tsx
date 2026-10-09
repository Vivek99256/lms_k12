'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, ImagePlus, Loader2, Search, Trash2, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const MAX_FILES = 10;

type MessageState = { type: 'success' | 'error' | 'info'; text: string };
type Option = { id: string; label: string };
type StudentHit = { id: string; label: string };
type PhotoSlot = { key: string; file: File; url: string };

type PhotoRow = {
  id: string;
  studentId: string;
  enrollmentNo: string;
  fullName: string;
  mobile: string;
  standardName: string;
  divisionName: string;
  imageUrl: string;
};

/** One entry per student, however many photos they have. */
type StudentGroup = Omit<PhotoRow, 'id' | 'imageUrl'> & { photos: Array<{ id: string; imageUrl: string }> };

function authHeaders(session: FeesSession): HeadersInit {
  return {
    Accept: 'application/json',
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

async function readEnvelope(response: Response): Promise<{ ok: boolean; message: string; data: unknown }> {
  let body: Record<string, unknown> = {};
  try {
    body = asRecord(await response.json());
  } catch {
    body = {};
  }
  return { ok: response.ok && Number(body.status) === 1, message: readString(body.message), data: body.data };
}

async function postForm(
  session: FeesSession,
  path: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; message: string; data: unknown }> {
  const body = new URLSearchParams(fields);
  if (session.academicYearId) body.set('syear', session.academicYearId);
  const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { ...authHeaders(session), 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: body.toString(),
  });
  return readEnvelope(response);
}

/** The shared admin dropdown endpoints (grade -> standard -> division), same ones Student Attendance uses. */
async function fetchMaster(session: FeesSession, endpoint: string, fields: Record<string, string>): Promise<Option[]> {
  const form = new FormData();
  form.set('sub_institute_id', session.subInstituteId);
  form.set('token', session.token);
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));

  const response = await fetch(`${session.hostName.replace(/\/$/, '')}/${endpoint}`, {
    method: 'POST',
    headers: authHeaders(session),
    body: form,
  });
  const payload = asRecord(await response.json());
  if (!response.ok || Number(payload.status) !== 1) return [];

  return toArray(payload.data)
    .map((item) => {
      const record = asRecord(item);
      return { id: readString(record.id), label: readString(record.name) || readString(record.title) };
    })
    .filter((option) => option.id && option.label);
}

function parsePhotos(value: unknown): PhotoRow[] {
  return toArray(value).map((entry) => {
    const record = asRecord(entry);
    return {
      id: readString(record.id),
      studentId: readString(record.student_id),
      enrollmentNo: readString(record.enrollment_no),
      fullName: readString(record.full_name),
      mobile: readString(record.mobile),
      standardName: readString(record.standard_name),
      divisionName: readString(record.division_name),
      imageUrl: readString(record.image_url),
    };
  }).filter((photo) => photo.id);
}

/** Groups by the student's unique id (falling back to GR no.), keeping the API's newest-first photo order. */
function groupByStudent(photos: PhotoRow[]): StudentGroup[] {
  const groups = new Map<string, StudentGroup>();
  photos.forEach((photo) => {
    const key = photo.studentId || photo.enrollmentNo || photo.id;
    const existing = groups.get(key);
    if (existing) {
      existing.photos.push({ id: photo.id, imageUrl: photo.imageUrl });
      return;
    }
    const { id, imageUrl, ...student } = photo;
    groups.set(key, { ...student, studentId: key, photos: [{ id, imageUrl }] });
  });
  return Array.from(groups.values());
}

export default function StudentFaceAttendancePage() {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const [grades, setGrades] = useState<Option[]>([]);
  const [standards, setStandards] = useState<Option[]>([]);
  const [divisions, setDivisions] = useState<Option[]>([]);
  const [grade, setGrade] = useState('');
  const [standard, setStandard] = useState('');
  const [division, setDivision] = useState('');

  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [studentQuery, setStudentQuery] = useState('');
  const [studentHits, setStudentHits] = useState<StudentHit[]>([]);
  const [pickedStudent, setPickedStudent] = useState<StudentHit | null>(null);
  const [newPhotos, setNewPhotos] = useState<PhotoSlot[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const newPhotosRef = useRef<PhotoSlot[]>([]);

  useEffect(() => {
    newPhotosRef.current = newPhotos;
  }, [newPhotos]);
  useEffect(() => () => newPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  const loadPhotos = async (filters: Record<string, string>) => {
    const session = getFeesSession();
    setSearching(true);
    setHasSearched(true);
    try {
      const envelope = await postForm(session, 'api/capture-photo/list', filters);
      if (!envelope.ok) throw new Error(envelope.message || "Couldn't load photos. Try again.");
      setPhotos(parsePhotos(asRecord(envelope.data).photos));
    } catch (error) {
      setPhotos([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't load photos. Try again." });
    } finally {
      setSearching(false);
    }
  };

  // Learn the role first; a student sees their own photos straight away, staff search by class.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const session = getFeesSession();
      if (!session.token || !session.subInstituteId) {
        setMessage({ type: 'error', text: 'Your session has expired. Sign in again.' });
        setReady(true);
        return;
      }
      try {
        const envelope = await postForm(session, 'api/capture-photo/list', { meta_only: '1' });
        if (!envelope.ok) throw new Error(envelope.message || "Couldn't load this page. Try again.");
        if (cancelled) return;

        const data = asRecord(envelope.data);
        const student = Boolean(data.is_student);
        setIsAdmin(Boolean(data.can_manage));
        setIsStudent(student);

        if (student) {
          await loadPhotos({});
        } else {
          const sections = await fetchMaster(session, 'get_adminAcademicSection', {});
          if (!cancelled) setGrades(sections);
        }
      } catch (error) {
        if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't load this page. Try again." });
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStandard('');
      setDivision('');
      setStandards([]);
      setDivisions([]);
      if (!grade) return;
      const options = await fetchMaster(getFeesSession(), 'get_adminStandard', { grade_id: grade });
      if (!cancelled) setStandards(options);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [grade]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDivision('');
      setDivisions([]);
      if (!standard) return;
      const options = await fetchMaster(getFeesSession(), 'get_adminDivision', { standard_id: standard });
      if (!cancelled) setDivisions(options);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [standard]);

  // Student lookup for admins (3+ characters, as the legacy page did).
  useEffect(() => {
    if (!isAdmin || pickedStudent || studentQuery.trim().length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const envelope = await postForm(getFeesSession(), 'api/capture-photo/students', { value: studentQuery.trim() });
        if (cancelled || !envelope.ok) return;
        setStudentHits(
          toArray(envelope.data)
            .map((entry) => {
              const record = asRecord(entry);
              return { id: readString(record.id), label: readString(record.student) };
            })
            .filter((hit) => hit.id),
        );
      } catch {
        if (!cancelled) setStudentHits([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAdmin, pickedStudent, studentQuery]);

  const handleSearch = () => {
    setMessage(null);
    void loadPhotos({
      ...(grade ? { grade } : {}),
      ...(standard ? { standard } : {}),
      ...(division ? { division } : {}),
    });
  };

  const handleFilesPicked = (fileList: FileList | null) => {
    if (!fileList) return;
    const picked = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    const room = MAX_FILES - newPhotos.length;

    if (picked.length < fileList.length) {
      setMessage({ type: 'error', text: 'Only image files can be uploaded.' });
    } else if (picked.length > room) {
      setMessage({ type: 'info', text: `You can upload at most ${MAX_FILES} photos at a time. Extra files were ignored.` });
    }

    const added = picked.slice(0, Math.max(room, 0)).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setNewPhotos((current) => [...current, ...added]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const removeNewPhoto = (key: string) => {
    setNewPhotos((current) => {
      const target = current.find((photo) => photo.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((photo) => photo.key !== key);
    });
  };

  const handleUpload = async () => {
    const session = getFeesSession();

    if (isAdmin && !pickedStudent) {
      setMessage({ type: 'info', text: 'Search and select a student first.' });
      return;
    }
    if (newPhotos.length === 0) {
      setMessage({ type: 'info', text: 'Choose at least one photo.' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      if (session.academicYearId) form.set('syear', session.academicYearId);
      if (isAdmin && pickedStudent) form.set('student_id', pickedStudent.id);
      newPhotos.forEach((photo) => form.append('stu_image[]', photo.file, photo.file.name));

      const response = await fetch('/api/proxy-file?path=api/capture-photo/store', {
        method: 'POST',
        headers: authHeaders(session),
        body: form,
      });
      const envelope = await readEnvelope(response);
      if (!envelope.ok) throw new Error(envelope.message || "Couldn't upload the photos. Try again.");

      newPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setNewPhotos([]);
      setMessage({ type: 'success', text: envelope.message || 'Photos added.' });
      if (isStudent) await loadPhotos({});
      else if (hasSearched) handleSearch();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't upload the photos. Try again." });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    const question = ids.length === 1
      ? 'Are you sure you want to delete this photo?'
      : `Are you sure you want to delete ${ids.length} selected photos?`;
    if (!window.confirm(question)) return;

    setDeleting(true);
    setMessage(null);
    try {
      const body = new URLSearchParams();
      ids.forEach((id) => body.append('ids[]', id));
      const session = getFeesSession();
      const response = await fetch('/api/proxy?path=api/capture-photo/delete', {
        method: 'POST',
        headers: { ...authHeaders(session), 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });
      const envelope = await readEnvelope(response);
      if (!envelope.ok) throw new Error(envelope.message || "Couldn't delete the photos. Try again.");

      setPhotos((current) => current.filter((photo) => !ids.includes(photo.id)));
      setMessage({ type: 'success', text: envelope.message || 'Photos deleted.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Couldn't delete the photos. Try again." });
    } finally {
      setDeleting(false);
    }
  };

  const students = useMemo(() => groupByStudent(photos), [photos]);
  const openStudent = useMemo(() => students.find((student) => student.studentId === openStudentId) ?? null, [students, openStudentId]);
  const columnCount = 8;
  const busy = uploading || deleting;
  const canUpload = ready && (isAdmin || isStudent);

  return (
    <PageFrame>
      <PageHeader
        title="Capture student photos"
        description="Reference photos that face matching uses to recognise each student when class attendance is captured."
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      {canUpload && (
        <SectionPanel
          title="Add photos"
          description={
            isAdmin
              ? 'Find a student by GR no. or name, then add one or more clear, front-facing photos.'
              : 'Add one or more clear, front-facing photos of yourself.'
          }
        >
          {isAdmin && (
            <div className="mb-4 max-w-md">
              <Field label="Student">
                <div className="relative">
                  <Input
                    value={pickedStudent ? pickedStudent.label : studentQuery}
                    placeholder="Type student name or GR no."
                    disabled={busy}
                    onChange={(event) => {
                      setPickedStudent(null);
                      setStudentQuery(event.target.value);
                    }}
                  />
                  {pickedStudent && (
                    <button
                      type="button"
                      aria-label="Clear student"
                      onClick={() => {
                        setPickedStudent(null);
                        setStudentQuery('');
                      }}
                      className="absolute right-2 top-2 rounded p-1 text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {!pickedStudent && studentQuery.trim().length >= 3 && studentHits.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {studentHits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setPickedStudent(hit);
                              setStudentHits([]);
                            }}
                          >
                            {hit.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {newPhotos.map((photo, index) => (
              <div key={photo.key} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`New photo ${index + 1}`} className="h-32 w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => removeNewPhoto(photo.key)}
                  disabled={busy}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="truncate px-2 py-1 text-xs text-slate-600">{photo.file.name}</div>
              </div>
            ))}
            {newPhotos.length < MAX_FILES && (
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
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => handleFilesPicked(event.target.files)}
          />

          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={handleUpload} disabled={busy || newPhotos.length === 0}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading...' : 'Upload photos'}
            </Button>
          </div>
        </SectionPanel>
      )}

      {!isStudent && (
        <SectionPanel title="Find photos" description="Narrow by class, or leave the filters empty to list every student's photos.">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Grade">
              <NativeSelect value={grade} onChange={setGrade} disabled={!ready}>
                <option value="">All grades</option>
                {grades.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Standard">
              <NativeSelect value={standard} onChange={setStandard} disabled={!grade}>
                <option value="">All standards</option>
                {standards.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Division">
              <NativeSelect value={division} onChange={setDivision} disabled={!standard}>
                <option value="">All divisions</option>
                {divisions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex items-end">
              <Button type="button" className="h-10 w-full" onClick={handleSearch} disabled={!ready || searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>
          </div>
        </SectionPanel>
      )}

      <SectionPanel
        title="Captured photos"
        description={students.length > 0 ? `${students.length} students, ${photos.length} photos. Open a student to see all of their photos.` : undefined}
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead>No.</TableHead>
                <TableHead>GR no.</TableHead>
                <TableHead>Student name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Photos</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searching ? (
                <LoadingRows colSpan={columnCount} label="Loading photos" />
              ) : students.length > 0 ? (
                students.map((student, index) => (
                  <TableRow key={student.studentId} className="odd:bg-white even:bg-slate-50/60">
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{student.enrollmentNo || '-'}</TableCell>
                    <TableCell className="font-medium text-slate-950">{student.fullName || '-'}</TableCell>
                    <TableCell>{student.mobile || '-'}</TableCell>
                    <TableCell>{student.standardName || '-'}</TableCell>
                    <TableCell>{student.divisionName || '-'}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setOpenStudentId(student.studentId)}
                        className="flex items-center gap-2"
                        aria-label={`View ${student.photos.length} photos of ${student.fullName || 'student'}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={student.photos[0].imageUrl}
                          alt={`Photo of ${student.fullName || 'student'}`}
                          width={50}
                          height={50}
                          className="h-[50px] w-[50px] rounded object-cover"
                        />
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {student.photos.length} {student.photos.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => setOpenStudentId(student.studentId)}>
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyTableRow
                  colSpan={columnCount}
                  label={
                    !ready
                      ? 'Loading...'
                      : isStudent || hasSearched
                        ? 'No photos found.'
                        : 'Choose filters and search to see captured photos.'
                  }
                />
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>

      <Dialog open={openStudent !== null} onOpenChange={(open) => !open && setOpenStudentId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {openStudent && (
            <>
              <DialogHeader>
                <DialogTitle>{openStudent.fullName || 'Student'}</DialogTitle>
                <DialogDescription>
                  GR no. {openStudent.enrollmentNo || '-'} · {openStudent.standardName || '-'} / {openStudent.divisionName || '-'} ·{' '}
                  {openStudent.photos.length} {openStudent.photos.length === 1 ? 'photo' : 'photos'}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {openStudent.photos.map((photo, index) => (
                  <div key={photo.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${index + 1} full size`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt={`Photo ${index + 1} of ${openStudent.fullName || 'student'}`}
                        className="h-48 w-full object-cover"
                      />
                    </a>
                    {isAdmin && (
                      <button
                        type="button"
                        aria-label={`Delete photo ${index + 1}`}
                        onClick={() => handleDelete([photo.id])}
                        disabled={busy}
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 text-rose-600 shadow hover:bg-white disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isAdmin && openStudent.photos.length > 1 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleDelete(openStudent.photos.map((photo) => photo.id))}
                    disabled={busy}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete all {openStudent.photos.length} photos
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
