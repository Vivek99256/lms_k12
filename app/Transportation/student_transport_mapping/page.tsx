<<<<<<< HEAD
import { TransportationPage } from "../_components/TransportationPage";
import { studentMappingConfig } from "../configs";
export default function Page() { return <TransportationPage config={studentMappingConfig} />; }
=======
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportRowsAsCsv, type TableExportRow } from "@/lib/table-export";
import {
  deleteStudentMappings,
  getTransportationSession,
  loadStudentMappings,
  saveStudentMappings,
  type StudentMappingData,
  type StudentMappingFilters,
  type StudentMappingPayload,
  type StudentMappingRow,
  type TransportOption,
} from "../api";

const EMPTY: StudentMappingData = {
  rows: [], mapped: [], shifts: [], shiftRates: [], vehicles: [], vehicleStops: [],
  seats: [], stops: [], grades: [], standards: [], divisions: [],
};

const EMPTY_FILTERS: StudentMappingFilters = {
  grade: "", standard: "", division: "", name: "", grno: "", area: "",
};

/** The six editable columns of a grid row. */
type RowDraft = {
  fromShiftId: string;
  fromBusId: string;
  fromStop: string;
  toShiftId: string;
  toBusId: string;
  toStop: string;
  distance: string;
  amount: string;
};

type Drafts = Record<number, RowDraft>;

function draftOf(row: StudentMappingRow): RowDraft {
  return {
    fromShiftId: row.fromShiftId,
    fromBusId: row.fromBusId,
    fromStop: row.fromStop,
    toShiftId: row.toShiftId,
    toBusId: row.toBusId,
    toStop: row.toStop,
    // The Blade grid defaults an unmapped student to 1 km.
    distance: row.distance || (row.mapped ? "0" : "1"),
    amount: row.amount || "0",
  };
}

const selectClass =
  "h-9 w-full min-w-[8rem] rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none " +
  "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400";

export default function StudentTransportMappingPage() {
  const [data, setData] = useState(EMPTY);
  const [filters, setFilters] = useState<StudentMappingFilters>(EMPTY_FILTERS);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);

  const load = useCallback(async (applied: StudentMappingFilters) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await loadStudentMappings(getTransportationSession(), applied);
      setData(result);
      setDrafts(Object.fromEntries(result.rows.map((row) => [row.studentId, draftOf(row)])));
      setSelected(new Set());
      setSearched(true);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Student mappings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Lookups (shifts, vehicles, stops, classes) are needed before the first
    // search; an empty filter set returns them without any student rows.
    void load(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const standards = useMemo(
    () => data.standards.filter((option) => !filters.grade || option.parentId === Number(filters.grade)),
    [data.standards, filters.grade]
  );

  const shiftRate = useCallback(
    (shiftId: string) => data.shiftRates.find((rate) => rate.id === Number(shiftId)),
    [data.shiftRates]
  );

  const vehiclesFor = useCallback(
    (shiftId: string): TransportOption[] =>
      shiftId ? data.vehicles.filter((vehicle) => vehicle.parentId === Number(shiftId)) : [],
    [data.vehicles]
  );

  const stopsFor = useCallback(
    (shiftId: string, vehicleId: string): TransportOption[] => {
      if (!shiftId || !vehicleId) return [];
      const unique = new Map<number, TransportOption>();
      data.vehicleStops
        .filter((stop) => stop.vehicleId === Number(vehicleId) && stop.shiftId === Number(shiftId))
        .forEach((stop) => unique.set(stop.stopId, { id: stop.stopId, label: stop.stopName }));
      return [...unique.values()];
    },
    [data.vehicleStops]
  );

  /** Remaining seats, discounting the students this grid is about to add. */
  const seatsFor = useCallback(
    (shiftId: string, vehicleId: string, studentId: number): string => {
      const seat = data.seats.find(
        (entry) => entry.vehicleId === Number(vehicleId) && entry.shiftId === Number(shiftId)
      );
      if (!seat || seat.capacity <= 0) return "";
      const claimed = [...selected]
        .filter((id) => id !== studentId)
        .filter((id) => {
          const draft = drafts[id];
          const row = data.rows.find((item) => item.studentId === id);
          return draft?.fromBusId === vehicleId && draft?.fromShiftId === shiftId && !row?.mapped;
        }).length;
      return `Seats ${Math.max(0, seat.capacity - seat.reserved - claimed)} / ${seat.capacity}`;
    },
    [data.seats, data.rows, drafts, selected]
  );

  /**
   * Fare follows the Blade rule exactly: a zero distance means no charge,
   * otherwise the pickup shift's flat rate plus a per-kilometre amount.
   */
  function priced(draft: RowDraft): string {
    const rate = shiftRate(draft.fromShiftId);
    const distance = Number(draft.distance);
    if (!rate || !Number.isFinite(distance)) return draft.amount;
    if (distance === 0) return "0";
    return (rate.shiftRate + distance * rate.kmAmount).toFixed(2);
  }

  function updateDraft(studentId: number, patch: Partial<RowDraft>) {
    setDrafts((current) => {
      const draft = { ...current[studentId], ...patch };
      return { ...current, [studentId]: { ...draft, amount: priced(draft) } };
    });
  }

  /** Changing a pickup shift invalidates the vehicle and stop chosen under it. */
  function changeFromShift(studentId: number, shiftId: string) {
    updateDraft(studentId, { fromShiftId: shiftId, fromBusId: "", fromStop: "" });
  }

  /** The Blade grid mirrors the pickup vehicle into the drop vehicle. */
  function changeFromBus(studentId: number, busId: string) {
    setDrafts((current) => {
      const draft = { ...current[studentId], fromBusId: busId, fromStop: "" };
      const mirrored = vehiclesFor(draft.toShiftId).some((vehicle) => vehicle.id === Number(busId));
      if (mirrored) {
        draft.toBusId = busId;
        draft.toStop = "";
      }
      return { ...current, [studentId]: { ...draft, amount: priced(draft) } };
    });
  }

  /** ...and mirrors the pickup stop into the drop stop. */
  function changeFromStop(studentId: number, stopId: string) {
    setDrafts((current) => {
      const draft = { ...current[studentId], fromStop: stopId };
      if (stopsFor(draft.toShiftId, draft.toBusId).some((stop) => stop.id === Number(stopId))) {
        draft.toStop = stopId;
      }
      return { ...current, [studentId]: draft };
    });
  }

  function toggle(studentId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) =>
      current.size === data.rows.length ? new Set() : new Set(data.rows.map((row) => row.studentId))
    );
  }

  function validate(): { payload: StudentMappingPayload[]; message: string } {
    const payload: StudentMappingPayload[] = [];
    for (const row of data.rows) {
      if (!selected.has(row.studentId)) continue;
      const draft = drafts[row.studentId];
      const missing = (
        [
          ["Pickup shift", draft.fromShiftId],
          ["Pickup vehicle", draft.fromBusId],
          ["Pickup stop", draft.fromStop],
          ["Drop shift", draft.toShiftId],
          ["Drop vehicle", draft.toBusId],
          ["Drop stop", draft.toStop],
        ] as const
      ).find(([, value]) => !value);
      if (missing) {
        return { payload: [], message: `${missing[0]} is required for ${row.studentName}.` };
      }
      if (Number(draft.distance) < 0 || !Number.isFinite(Number(draft.distance))) {
        return { payload: [], message: `Distance must be zero or more for ${row.studentName}.` };
      }
      payload.push({
        student_id: row.studentId,
        student_name: row.studentName,
        from_shift_id: Number(draft.fromShiftId),
        from_bus_id: Number(draft.fromBusId),
        from_stop: Number(draft.fromStop),
        to_shift_id: Number(draft.toShiftId),
        to_bus_id: Number(draft.toBusId),
        to_stop: Number(draft.toStop),
        distance: Number(draft.distance) || 0,
        amount: Number(draft.amount) || 0,
      });
    }
    if (!payload.length) return { payload: [], message: "Select at least one student." };
    return { payload, message: "" };
  }

  async function save() {
    const { payload, message } = validate();
    if (message) {
      setError(message);
      setNotice("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await saveStudentMappings(getTransportationSession(), payload);
      setNotice(result);
      await load(filters);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Student mappings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const removable = data.rows.filter((row) => selected.has(row.studentId) && row.mapped);
    if (!removable.length) {
      setError("Select at least one mapped student to remove.");
      return;
    }
    if (!window.confirm(`Remove the transport mapping for ${removable.length} student(s)?`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteStudentMappings(
        getTransportationSession(),
        removable.map((row) => row.studentId)
      );
      setNotice(result);
      await load(filters);
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "Student mappings could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const label = (options: TransportOption[], id: string) =>
      options.find((option) => option.id === Number(id))?.label || "";
    const rows: TableExportRow[] = data.rows.map((row) => {
      const draft = drafts[row.studentId];
      return {
        student_name: row.studentName,
        enrollment_no: row.enrollmentNo,
        standard_division: row.standardDivision,
        mobile: row.mobile,
        from_shift: label(data.shifts, draft.fromShiftId),
        from_bus: label(data.vehicles, draft.fromBusId),
        from_stop: label(data.stops, draft.fromStop),
        distance: draft.distance,
        amount: draft.amount,
        to_shift: label(data.shifts, draft.toShiftId),
        to_bus: label(data.vehicles, draft.toBusId),
        to_stop: label(data.stops, draft.toStop),
      };
    });
    exportRowsAsCsv({
      filename: "student-transport-mapping.csv",
      columns: [
        { key: "student_name", label: "Student" }, { key: "enrollment_no", label: "GR No." },
        { key: "standard_division", label: "Std / Div" }, { key: "mobile", label: "Mobile" },
        { key: "from_shift", label: "From shift" }, { key: "from_bus", label: "From bus" },
        { key: "from_stop", label: "From stop" }, { key: "distance", label: "Distance" },
        { key: "amount", label: "Amount" }, { key: "to_shift", label: "To shift" },
        { key: "to_bus", label: "To bus" }, { key: "to_stop", label: "To stop" },
      ],
      rows,
    });
  }

  const mappedCount = data.rows.filter((row) => row.mapped).length;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Student transport mapping</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search students, then assign pickup and drop shift, vehicle and stop for the current academic year.
          </p>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b"><CardTitle>Search students</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div>
                <Label htmlFor="grade">Grade</Label>
                <select id="grade" className={`mt-1 ${selectClass}`} value={filters.grade}
                  onChange={(event) => setFilters((current) => ({ ...current, grade: event.target.value, standard: "" }))}>
                  <option value="">All grades</option>
                  {data.grades.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="standard">Standard</Label>
                <select id="standard" className={`mt-1 ${selectClass}`} value={filters.standard}
                  onChange={(event) => setFilters((current) => ({ ...current, standard: event.target.value }))}>
                  <option value="">All standards</option>
                  {standards.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="division">Division</Label>
                <select id="division" className={`mt-1 ${selectClass}`} value={filters.division}
                  onChange={(event) => setFilters((current) => ({ ...current, division: event.target.value }))}>
                  <option value="">All divisions</option>
                  {data.divisions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="name">Student name</Label>
                <Input id="name" className="mt-1" value={filters.name}
                  onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))} placeholder="Enter student name" />
              </div>
              <div>
                <Label htmlFor="grno">GR number</Label>
                <Input id="grno" className="mt-1" value={filters.grno}
                  onChange={(event) => setFilters((current) => ({ ...current, grno: event.target.value }))} placeholder="Enter GR number" />
              </div>
              <div>
                <Label htmlFor="area">Area (pickup stop)</Label>
                <select id="area" className={`mt-1 ${selectClass}`} value={filters.area}
                  onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))}>
                  <option value="">All areas</option>
                  {data.stops.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void load(filters)} disabled={loading || busy}>
                {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />} Search
              </Button>
              <Button variant="outline" onClick={() => { setFilters(EMPTY_FILTERS); void load(EMPTY_FILTERS); }} disabled={loading || busy}>
                <RotateCcw className="size-4" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <CardTitle>
                {data.rows.length} student(s){data.rows.length > 0 && <span className="ml-2 text-sm font-normal text-slate-500">{mappedCount} already mapped</span>}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportCsv} disabled={!data.rows.length}><Download className="size-4" /> CSV</Button>
                <Button variant="outline" onClick={() => void remove()} disabled={busy || !selected.size}>
                  <Trash2 className="size-4 text-red-600" /> Remove mapping
                </Button>
                <Button onClick={() => void save()} disabled={busy || !selected.size}>
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input type="checkbox" aria-label="Select all students" checked={data.rows.length > 0 && selected.size === data.rows.length}
                        onChange={toggleAll} disabled={!data.rows.length} />
                    </TableHead>
                    <TableHead>Sr.</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Std / Div</TableHead>
                    <TableHead>GR No.</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>From shift</TableHead>
                    <TableHead>From bus</TableHead>
                    <TableHead>From stop</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>To shift</TableHead>
                    <TableHead>To bus</TableHead>
                    <TableHead>To stop</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={14} className="h-32 text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" /></TableCell></TableRow>
                  ) : !data.rows.length ? (
                    <TableRow><TableCell colSpan={14} className="h-32 text-center text-slate-500">
                      {searched ? "No student found. Adjust the search filters above." : "Search for students to begin."}
                    </TableCell></TableRow>
                  ) : (
                    data.rows.map((row, index) => {
                      const draft = drafts[row.studentId];
                      const active = selected.has(row.studentId);
                      return (
                        <TableRow key={row.studentId} className={active ? "bg-blue-50/40" : undefined}>
                          <TableCell><input type="checkbox" aria-label={`Select ${row.studentName}`} checked={active} onChange={() => toggle(row.studentId)} /></TableCell>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900">{row.studentName}</div>
                            {row.mapped && <div className="text-xs text-emerald-600">Mapped</div>}
                          </TableCell>
                          <TableCell>{row.standardDivision || "—"}</TableCell>
                          <TableCell>{row.enrollmentNo || "—"}</TableCell>
                          <TableCell>{row.mobile || "—"}</TableCell>
                          <TableCell>
                            <select className={selectClass} disabled={!active} value={draft.fromShiftId}
                              onChange={(event) => changeFromShift(row.studentId, event.target.value)}>
                              <option value="">Select</option>
                              {data.shifts.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                          </TableCell>
                          <TableCell>
                            <select className={selectClass} disabled={!active || !draft.fromShiftId} value={draft.fromBusId}
                              onChange={(event) => changeFromBus(row.studentId, event.target.value)}>
                              <option value="">Select</option>
                              {vehiclesFor(draft.fromShiftId).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                            {active && draft.fromBusId && (
                              <div className="mt-1 text-xs text-slate-500">{seatsFor(draft.fromShiftId, draft.fromBusId, row.studentId)}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <select className={selectClass} disabled={!active || !draft.fromBusId} value={draft.fromStop}
                              onChange={(event) => changeFromStop(row.studentId, event.target.value)}>
                              <option value="">Select</option>
                              {stopsFor(draft.fromShiftId, draft.fromBusId).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.01" className="h-9 w-24" disabled={!active} value={draft.distance}
                              onChange={(event) => updateDraft(row.studentId, { distance: event.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9 w-24 bg-slate-50" readOnly value={draft.amount} />
                          </TableCell>
                          <TableCell>
                            <select className={selectClass} disabled={!active} value={draft.toShiftId}
                              onChange={(event) => updateDraft(row.studentId, { toShiftId: event.target.value, toBusId: "", toStop: "" })}>
                              <option value="">Select</option>
                              {data.shifts.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                          </TableCell>
                          <TableCell>
                            <select className={selectClass} disabled={!active || !draft.toShiftId} value={draft.toBusId}
                              onChange={(event) => updateDraft(row.studentId, { toBusId: event.target.value, toStop: "" })}>
                              <option value="">Select</option>
                              {vehiclesFor(draft.toShiftId).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                          </TableCell>
                          <TableCell>
                            <select className={selectClass} disabled={!active || !draft.toBusId} value={draft.toStop}
                              onChange={(event) => updateDraft(row.studentId, { toStop: event.target.value })}>
                              <option value="">Select</option>
                              {stopsFor(draft.toShiftId, draft.toBusId).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
