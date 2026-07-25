"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UtilityStudent } from "../_lib/students";
import { UtilityEmpty } from "./utility-ui";

/**
 * Checkbox student grid shared by Student transfer, Rollover and Transfer
 * student. Rows already present in the destination year are locked and tinted
 * green, mirroring the legacy Blade behaviour and its "Note" tooltip.
 */
export function StudentSelectionTable({
  students,
  selectedIds,
  onToggle,
  onToggleAll,
  emptyTitle = "No students found.",
  emptyHint,
  showRollNo = false,
  showGender = false,
  lockedHint = "Highlighted rows already exist in the destination year and cannot be selected.",
}: {
  students: UtilityStudent[];
  selectedIds: number[];
  onToggle: (studentId: number) => void;
  onToggleAll: (checked: boolean) => void;
  emptyTitle?: string;
  emptyHint?: string;
  showRollNo?: boolean;
  showGender?: boolean;
  lockedHint?: string;
}) {
  if (students.length === 0) {
    return <UtilityEmpty title={emptyTitle} hint={emptyHint} />;
  }

  const selectable = students.filter((student) => !student.alreadyExists);
  const allSelected =
    selectable.length > 0 && selectable.every((student) => selectedIds.includes(student.studentId));
  const hasLocked = students.some((student) => student.alreadyExists);

  return (
    <div className="space-y-3">
      {hasLocked ? <p className="text-xs text-slate-500">{lockedHint}</p> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all students"
                  className="size-4 accent-blue-600"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </TableHead>
              <TableHead className="w-14">Sr. no.</TableHead>
              <TableHead>Student name</TableHead>
              <TableHead>GR no.</TableHead>
              <TableHead>Standard</TableHead>
              <TableHead>Division</TableHead>
              {showRollNo ? <TableHead>Roll no.</TableHead> : null}
              {showGender ? <TableHead>Gender</TableHead> : null}
              <TableHead>Mobile</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student, index) => (
              <TableRow
                key={student.studentId}
                className={student.alreadyExists ? "bg-emerald-50" : undefined}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${student.name}`}
                    className="size-4 accent-blue-600"
                    checked={selectedIds.includes(student.studentId)}
                    disabled={student.alreadyExists}
                    onChange={() => onToggle(student.studentId)}
                  />
                </TableCell>
                <TableCell className="text-slate-500">{index + 1}</TableCell>
                <TableCell className="font-medium text-slate-900">{student.name}</TableCell>
                <TableCell className="font-mono text-xs">{student.enrollmentNo || "—"}</TableCell>
                <TableCell>{student.standardName || "—"}</TableCell>
                <TableCell>{student.divisionName || "—"}</TableCell>
                {showRollNo ? <TableCell>{student.rollNo || "—"}</TableCell> : null}
                {showGender ? <TableCell>{student.gender || "—"}</TableCell> : null}
                <TableCell className="font-mono text-xs">{student.mobile || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-slate-500">
        {selectedIds.length} of {selectable.length} selectable students chosen.
      </p>
    </div>
  );
}
