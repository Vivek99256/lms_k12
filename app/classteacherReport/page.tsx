"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from "@/lib/table-export";
import {
  loadClassTeachers,
  type ClassTeacherAssignment,
  type ClassTeacherBootstrap,
} from "@/app/classteacher/api";

const PAGE_SIZE = 10;
const controlClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:bg-slate-50 disabled:opacity-60";
const emptyData: ClassTeacherBootstrap = {
  assignments: [],
  academicSections: [],
  standards: [],
  divisions: [],
  teachers: [],
};
const exportColumns: TableExportColumn[] = [
  { key: "serial", label: "Sr. No." },
  { key: "teacher", label: "Class Teacher" },
  { key: "section", label: "Academic Section" },
  { key: "standard", label: "Standard" },
  { key: "division", label: "Division" },
];

function exportRow(
  assignment: ClassTeacherAssignment,
  index: number
): TableExportRow {
  return {
    serial: String(index + 1),
    teacher: assignment.teacherName,
    section: assignment.academicSectionName,
    standard: assignment.standardName,
    division: assignment.divisionName,
  };
}

function uniqueOptions<T extends { id: number; name: string }>(
  options: T[]
): T[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${option.id}:${option.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ClassTeacherReportPage() {
  const [data, setData] = useState<ClassTeacherBootstrap>(emptyData);
  const [sectionId, setSectionId] = useState("");
  const [standardId, setStandardId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [generated, setGenerated] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadClassTeachers());
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Class-teacher report data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage provides the authenticated ERP session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const sections = uniqueOptions(data.academicSections);
  const standards = sectionId
    ? uniqueOptions(
        data.standards.filter(
          (standard) => standard.gradeId === Number(sectionId)
        )
      )
    : [];
  const divisions = standardId
    ? uniqueOptions(
        data.divisions.filter(
          (division) => division.standardId === Number(standardId)
        )
      )
    : [];
  const teachers = uniqueOptions(data.teachers);
  const filtered = useMemo(() => {
    if (!generated) return [];
    const search = query.trim().toLowerCase();
    return data.assignments.filter(
      (assignment) =>
        (!sectionId || assignment.gradeId === Number(sectionId)) &&
        (!standardId || assignment.standardId === Number(standardId)) &&
        (!divisionId || assignment.divisionId === Number(divisionId)) &&
        (!teacherId || assignment.teacherId === Number(teacherId)) &&
        (!search ||
          [
            assignment.teacherName,
            assignment.academicSectionName,
            assignment.standardName,
            assignment.divisionName,
          ].some((value) => value.toLowerCase().includes(search)))
    );
  }, [
    data.assignments,
    divisionId,
    generated,
    query,
    sectionId,
    standardId,
    teacherId,
  ]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const exportRows = filtered.map(exportRow);

  function generate(event: React.FormEvent) {
    event.preventDefault();
    setGenerated(true);
    setQuery("");
    setPage(1);
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Class Teacher Report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review class-teacher assignments by academic section and class.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={generate}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportSelect
            id="class-report-section"
            label="Academic section"
            value={sectionId}
            onChange={(value) => {
              setSectionId(value);
              setStandardId("");
              setDivisionId("");
            }}
            options={sections}
            placeholder="All sections"
          />
          <ReportSelect
            id="class-report-standard"
            label="Standard"
            value={standardId}
            onChange={(value) => {
              setStandardId(value);
              setDivisionId("");
            }}
            options={standards}
            placeholder={
              sectionId ? "All standards" : "Select section first"
            }
            disabled={!sectionId}
          />
          <ReportSelect
            id="class-report-division"
            label="Division"
            value={divisionId}
            onChange={setDivisionId}
            options={divisions}
            placeholder={
              standardId ? "All divisions" : "Select standard first"
            }
            disabled={!standardId}
          />
          <ReportSelect
            id="class-report-teacher"
            label="Teacher"
            value={teacherId}
            onChange={setTeacherId}
            options={teachers}
            placeholder="All teachers"
          />
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Generate report
          </Button>
        </div>
      </form>

      {generated ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search class-teacher report..."
                className="h-8 pl-8"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <ExportButtons rows={exportRows} columns={exportColumns} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Sr. No.</TableHead>
                  <TableHead>Class Teacher</TableHead>
                  <TableHead>Academic Section</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Division</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length ? (
                  visible.map((assignment, index) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>{assignment.teacherName}</TableCell>
                      <TableCell>
                        {assignment.academicSectionName}
                      </TableCell>
                      <TableCell>{assignment.standardName}</TableCell>
                      <TableCell>{assignment.divisionName}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-slate-500"
                    >
                      <Users className="mx-auto mb-2 size-8 text-slate-300" />
                      No class-teacher assignments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationFooter
            count={filtered.length}
            currentPage={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </section>
      ) : null}
    </main>
  );
}

function ReportSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: number; name: string }>;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={controlClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExportButtons({
  rows,
  columns,
}: {
  rows: TableExportRow[];
  columns: TableExportColumn[];
}) {
  return (
    <>
      <Button
        variant="outline"
        disabled={!rows.length}
        onClick={() =>
          exportRowsAsCsv({
            filename: "class-teacher-report.csv",
            columns,
            rows,
          })
        }
      >
        <Download className="size-4" />
        CSV
      </Button>
      <Button
        variant="outline"
        disabled={!rows.length}
        onClick={() =>
          exportRowsAsExcel({
            filename: "class-teacher-report.xls",
            title: "Class Teacher Report",
            columns,
            rows,
          })
        }
      >
        <FileSpreadsheet className="size-4" />
        Excel
      </Button>
      <Button
        variant="outline"
        disabled={!rows.length}
        onClick={() =>
          openPrintPreview({
            title: "Class Teacher Report",
            subtitle: "Class-teacher assignments",
            columns,
            rows,
          })
        }
      >
        <Printer className="size-4" />
        Print / PDF
      </Button>
    </>
  );
}

function PaginationFooter({
  count,
  currentPage,
  pageCount,
  onPageChange,
}: {
  count: number;
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (!count) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {(currentPage - 1) * PAGE_SIZE + 1}–
        {Math.min(currentPage * PAGE_SIZE, count)} of {count}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          Previous
        </Button>
        <span className="px-2">
          Page {currentPage} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === pageCount}
          onClick={() =>
            onPageChange(Math.min(pageCount, currentPage + 1))
          }
        >
          Next
        </Button>
      </div>
    </div>
  );
}
