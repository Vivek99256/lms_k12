"use client";

<<<<<<< HEAD
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
=======
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
import { LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createVisitor,
  defaultVisitorForm,
  getHostelSession,
  loadVisitorFormOptions,
  loadVisitorList,
  todayRange,
  visitorStats,
  visitorValidation,
  type VisitorFilters,
  type VisitorFormOptions,
  type VisitorFormState,
  type VisitorRecord,
} from "../api";

type Mode = "details" | "report";

const EMPTY_OPTIONS: VisitorFormOptions = { visitorTypes: [], toMeet: [] };

function text(value: string) {
  return value.trim().toLowerCase();
}

export function VisitorModulePage({ mode }: { mode: Mode }) {
  const [filters, setFilters] = useState<VisitorFilters>(todayRange());
  const [records, setRecords] = useState<VisitorRecord[]>([]);
  const [options, setOptions] = useState<VisitorFormOptions>(EMPTY_OPTIONS);
  const [form, setForm] = useState<VisitorFormState>(defaultVisitorForm());
  const [showForm, setShowForm] = useState(mode === "details");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

<<<<<<< HEAD
=======
  const optionsRef = useRef<VisitorFormOptions>(EMPTY_OPTIONS);

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  const load = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const session = getHostelSession();
      const [loadedRecords, loadedOptions] = await Promise.all([
        loadVisitorList(session, nextFilters),
<<<<<<< HEAD
        mode === "details" ? loadVisitorFormOptions(session) : Promise.resolve(options),
      ]);
      setRecords(loadedRecords);
      if (mode === "details") setOptions(loadedOptions);
=======
        mode === "details" ? loadVisitorFormOptions(session) : Promise.resolve(optionsRef.current),
      ]);
      setRecords(loadedRecords);
      if (mode === "details") {
        optionsRef.current = loadedOptions;
        setOptions(loadedOptions);
      }
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Visitor data could not be loaded.");
    } finally {
      setLoading(false);
    }
<<<<<<< HEAD
  }, [filters, mode, options]);

  useEffect(() => {
    // The visitor data depends on browser session storage and token auth.
=======
  }, [filters, mode]);

  useEffect(() => {
    // Refresh only when the date filters change (not on every state update),
    // so the list behaves like the legacy ERP screen instead of auto-polling.
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(filters);
  }, [filters, load]);

  const filtered = useMemo(() => {
    const normalizedQuery = text(query);
    if (!normalizedQuery) return records;
    return records.filter((record) => (
      [
        record.name,
        record.contact,
        record.visitorTypeName,
        record.toMeetName,
        record.purpose,
        record.comingFrom,
      ].some((value) => text(value).includes(normalizedQuery))
    ));
  }, [query, records]);

  const stats = useMemo(() => visitorStats(records), [records]);

  function updateForm<K extends keyof VisitorFormState>(key: K, value: VisitorFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(defaultVisitorForm());
    setShowForm(false);
  }

  async function submitVisitor() {
    const validationError = visitorValidation(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const session = getHostelSession();
      setNotice(await createVisitor(session, form));
      setForm(defaultVisitorForm());
      await load(filters);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Visitor could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    updateForm("visitor_photo", event.target.files?.[0] || null);
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">{mode === "details" ? "Visitor Details" : "Visitor Report"}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "details"
                ? "Laravel visitor fields, validations, and list/report behavior were mapped into the existing Next.js design system."
                : "Search visitors by date range using the existing token-capable Laravel admin API."}
            </p>
          </div>
          {mode === "details" && (
            <Button onClick={() => setShowForm((current) => !current)}>
              <Plus className="size-4" /> {showForm ? "Hide Form" : "Add Visitor"}
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Visitors</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.total}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Checked In</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.active}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Checked Out</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.completed}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Direct Visits</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.direct}</CardContent></Card>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        {mode === "details" && showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add Visitor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label htmlFor="appointment_type">Appointment Type</Label>
                  <select
                    id="appointment_type"
                    value={form.appointment_type}
                    onChange={(event) => updateForm("appointment_type", event.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Direct">Direct</option>
                    <option value="Prior">Prior</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="visitor_type">Visitor Type *</Label>
                  <select
                    id="visitor_type"
                    value={form.visitor_type}
                    onChange={(event) => updateForm("visitor_type", event.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Visitor Type</option>
                    {options.visitorTypes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="name">Visitor Name *</Label>
                  <Input id="name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="contact">Mobile Number *</Label>
                  <Input id="contact" value={form.contact} onChange={(event) => updateForm("contact", event.target.value)} className="mt-1" maxLength={10} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="to_meet">To Meet *</Label>
                  <select
                    id="to_meet"
                    value={form.to_meet}
                    onChange={(event) => updateForm("to_meet", event.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Staff Member</option>
                    {options.toMeet.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="coming_from">Coming From</Label>
                  <Input id="coming_from" value={form.coming_from} onChange={(event) => updateForm("coming_from", event.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="relation">Relation</Label>
                  <Input id="relation" value={form.relation} onChange={(event) => updateForm("relation", event.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="visitor_idcard">Visitor ID Card No.</Label>
                  <Input id="visitor_idcard" value={form.visitor_idcard} onChange={(event) => updateForm("visitor_idcard", event.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="purpose">Purpose of Visit *</Label>
                  <Input id="purpose" value={form.purpose} onChange={(event) => updateForm("purpose", event.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="meet_date">Meet Date</Label>
                  <Input id="meet_date" type="date" value={form.meet_date} onChange={(event) => updateForm("meet_date", event.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="in_time">Checkin Time</Label>
                  <Input id="in_time" type="time" value={form.in_time} onChange={(event) => updateForm("in_time", event.target.value)} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="visitor_photo">Visitor Photo</Label>
                  <Input id="visitor_photo" type="file" accept="image/*" onChange={onFileChange} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void submitVisitor()} disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />} Save</Button>
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="border-b">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
              <div>
                <Label htmlFor="visitor-search">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input id="visitor-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search visitors..." className="pl-9" />
                </div>
              </div>
              <div>
                <Label htmlFor="from-date">From Date</Label>
                <Input id="from-date" type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="to-date">To Date</Label>
                <Input id="to-date" type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} className="mt-1" />
              </div>
              <Button variant="outline" onClick={() => void load(filters)} disabled={loading}>
                <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>To Meet</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Checkin</TableHead>
                    <TableHead>Checkout</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">
                        <LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                        No visitors found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="min-w-44">
                            <p className="font-medium text-slate-900">{record.name}</p>
                            <p className="text-xs text-slate-500">{record.comingFrom || "No source provided"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{record.visitorTypeName || "—"}</TableCell>
                        <TableCell>{record.contact || "—"}</TableCell>
                        <TableCell>{record.toMeetName || "—"}</TableCell>
                        <TableCell>{record.purpose || "—"}</TableCell>
                        <TableCell>{record.meetDate || "—"}</TableCell>
                        <TableCell>{record.inTime || "—"}</TableCell>
                        <TableCell>{record.outTime || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={record.outTime ? "secondary" : "default"}>
                            {record.outTime ? "Checked Out" : "Checked In"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
