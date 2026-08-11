"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  fetchStudentRequestFormData,
  submitStudentRequests,
  type RequestTypeOption,
  type StudentRosterRow,
} from "./api";
import SearchDropdown from "@/components/search-dropdown/SearchDropdown";
import type {
  AcademicSection,
  Division,
  DropdownValue,
  Standard,
} from "@/components/search-dropdown/types";
import { Button } from "@/components/ui/button";

function getSingleValue(value: DropdownValue | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

type RowState = {
  selected: boolean;
  changeRequestId: string;
  proofOfDocument: string;
  reason: string;
  description: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Page() {
  const [grade, setGrade] = useState("");
  const [standard, setStandard] = useState("");
  const [division, setDivision] = useState("");

  const [students, setStudents] = useState<StudentRosterRow[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestTypeOption[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const handleSectionChange = (value: DropdownValue, _selectedData: AcademicSection[]) => {
    setGrade(getSingleValue(value));
    setStandard("");
    setDivision("");
  };

  const handleStandardChange = (value: DropdownValue, _selectedData: Standard[]) => {
    setStandard(getSingleValue(value));
    setDivision("");
  };

  const handleDivisionChange = (value: DropdownValue, _selectedData: Division[]) => {
    setDivision(getSingleValue(value));
  };

  const getRow = (id: string): RowState =>
    rowState[id] ?? {
      selected: false,
      changeRequestId: "",
      proofOfDocument: "",
      reason: "",
      description: "",
    };

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRowState((prev) => ({ ...prev, [id]: { ...getRow(id), ...patch } }));
  };

  const handleSearchStudents = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await fetchStudentRequestFormData({ grade, standard, division });
      setStudents(data.students);
      setRequestTypes(data.requestTypes);
      setRowState({});
      setPage(1);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(term) ||
        student.enrollmentNo.toLowerCase().includes(term)
    );
  }, [students, search]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedStudents = filteredStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const selectedCount = Object.values(rowState).filter((row) => row.selected).length;

  const handleSubmit = async () => {
    const rows = students
      .filter((student) => rowState[student.id]?.selected)
      .map((student) => {
        const row = getRow(student.id);
        return {
          studentId: student.id,
          standardId: student.standardId,
          sectionId: student.sectionId,
          changeRequestId: row.changeRequestId,
          reason: row.reason,
          description: row.description,
          proofOfDocument: row.proofOfDocument,
        };
      });

    if (rows.length === 0) {
      setError("Select at least one student to proceed.");
      return;
    }
    if (rows.some((row) => !row.changeRequestId)) {
      setError("Choose a request type for every selected student.");
      return;
    }
    const missingProof = rows.some((row) => {
      const requestType = requestTypes.find((type) => type.id === row.changeRequestId);
      return requestType?.proofRequired && !row.proofOfDocument.trim();
    });
    if (missingProof) {
      setError("Provide the required document for every selected student.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const resultMessage = await submitStudentRequests(rows);
      setMessage(resultMessage);
      setRowState({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit student requests");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-full">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Raise student change request</h1>
            <p className="mt-1 text-sm text-slate-500">
              Select a grade and standard, then choose students to raise a change request for.
            </p>
          </div>
          {selectedCount > 0 && (
            <span className="whitespace-nowrap text-sm text-slate-400">
              {selectedCount} student{selectedCount === 1 ? "" : "s"} selected
            </span>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <SearchDropdown
            fields={["section", "standard", "division"]}
            values={{ section: grade, standard, division }}
            required={{ section: false, standard: false }}
            labels={{ section: "Grade", standard: "Standard", division: "Division" }}
            placeholders={{
              section: "Select grade",
              standard: "Select standard",
              division: "Select division",
            }}
            onSectionChange={handleSectionChange}
            onStandardChange={handleStandardChange}
            onDivisionChange={handleDivisionChange}
          />
          <div className="mt-4 flex justify-end">
            <Button type="button" className="h-10" onClick={handleSearchStudents} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {hasSearched && requestTypes.length === 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No request types are configured for this academic year, so a request type cannot be
            selected yet. Add request types from the Student Change Request Type master before
            raising requests here.
          </div>
        )}

        {hasSearched && (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Show
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-indigo-500"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                entries
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                Search:
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
                  placeholder="GR no. or name"
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-10 px-4 py-3" />
                    <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      GR No.
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Student Name
                    </th>
                    <th className="min-w-44 px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Request Type
                    </th>
                    <th className="min-w-40 px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Document
                    </th>
                    <th className="min-w-40 px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Reason
                    </th>
                    <th className="min-w-48 px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedStudents.map((student) => {
                    const row = getRow(student.id);
                    const requestType = requestTypes.find((type) => type.id === row.changeRequestId);
                    return (
                      <tr key={student.id} className={row.selected ? "bg-indigo-50/40" : undefined}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(event) =>
                              updateRow(student.id, { selected: event.target.checked })
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700">
                          {student.enrollmentNo}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-900">
                          {student.name}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.changeRequestId}
                            onChange={(event) =>
                              updateRow(student.id, { changeRequestId: event.target.value })
                            }
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-indigo-500"
                          >
                            <option value="">Select request type</option>
                            {requestTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.title}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.proofOfDocument}
                            onChange={(event) =>
                              updateRow(student.id, { proofOfDocument: event.target.value })
                            }
                            placeholder={
                              requestType?.proofRequired
                                ? `${requestType.proofLabel} (required)`
                                : requestType?.proofLabel || "Document"
                            }
                            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.reason}
                            onChange={(event) => updateRow(student.id, { reason: event.target.value })}
                            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.description}
                            onChange={(event) =>
                              updateRow(student.id, { description: event.target.value })
                            }
                            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {pagedStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                        No students found for this selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
              <span className="text-sm text-slate-500">
                {filteredStudents.length === 0
                  ? "Showing 0 entries"
                  : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(
                      currentPage * pageSize,
                      filteredStudents.length
                    )} of ${filteredStudents.length} entries`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-indigo-600 px-2 text-sm font-medium text-white">
                  {currentPage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="flex justify-center border-t border-slate-200 px-4 py-5">
              <Button type="button" onClick={handleSubmit} disabled={submitting || selectedCount === 0}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
