"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  Search,
} from "lucide-react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  type TableExportRow,
} from "@/lib/table-export";
import {
  loadReportBootstrap,
  runUserReport,
  type Option,
  type ReportColumn,
  type ReportField,
} from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const controlClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/50";

export default function UserReportPage() {
  const [fields, setFields] = useState<ReportField[]>([]);
  const [profiles, setProfiles] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);
  const [fieldIds, setFieldIds] = useState<number[]>([]);
  const [profileIds, setProfileIds] = useState<number[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [status, setStatus] = useState(1);
  const [columns, setColumns] = useState<ReportColumn[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [chartKey, setChartKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadReportBootstrap();
      setFields(data.fields);
      setProfiles(data.profiles);
      setEmployees(data.employees);
    } catch (value: unknown) {
      setError(
        value instanceof Error
          ? value.message
          : "Report filters could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Authenticated browser storage supplies the ERP API session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const groups = useMemo(
    () =>
      Object.entries(
        fields.reduce<Record<string, ReportField[]>>((all, field) => {
          (all[field.group || "Fields"] ??= []).push(field);
          return all;
        }, {})
      ),
    [fields]
  );

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return !normalizedQuery
      ? rows
      : rows.filter((row) =>
          columns.some((column) =>
            String(row[column.key] ?? "")
              .toLowerCase()
              .includes(normalizedQuery)
          )
        );
  }, [columns, query, rows]);

  const effectiveChartKey = columns.some(
    (column) => column.key === chartKey
  )
    ? chartKey
    : (
        columns.find((column) =>
          /profile|department|gender|status/i.test(column.label)
        ) ?? columns[0]
      )?.key ?? "";
  const chartColumn = columns.find(
    (column) => column.key === effectiveChartKey
  );

  const chartGroups = useMemo(() => {
    if (!effectiveChartKey) return [];
    const counts = new Map<string, number>();
    visibleRows.forEach((row) => {
      const rawValue = String(row[effectiveChartKey] ?? "").trim();
      const label = rawValue || "Not specified";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    const sorted = Array.from(counts, ([label, count]) => ({
      label,
      count,
    })).sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label)
    );
    if (sorted.length <= 10) return sorted;
    return [
      ...sorted.slice(0, 10),
      {
        label: "Other",
        count: sorted
          .slice(10)
          .reduce((total, item) => total + item.count, 0),
      },
    ];
  }, [effectiveChartKey, visibleRows]);

  const chartData = useMemo(
    () => ({
      labels: chartGroups.map((item) => item.label),
      datasets: [
        {
          label: "Users",
          data: chartGroups.map((item) => item.count),
          backgroundColor: "#4f46e5",
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    }),
    [chartGroups]
  );

  const chartOptions: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          padding: 12,
          callbacks: {
            label: (context) =>
              `${context.parsed.y} user${context.parsed.y === 1 ? "" : "s"}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            font: { size: 11 },
            maxRotation: 35,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          ticks: {
            color: "#64748b",
            font: { size: 11 },
            precision: 0,
          },
        },
      },
    }),
    []
  );

  const exportRows: TableExportRow[] = visibleRows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [
        column.key,
        String(row[column.key] ?? ""),
      ])
    )
  );
  const exportColumns = columns.map((column) => ({
    key: column.key,
    label: column.label,
  }));

  async function generateReport(event: React.FormEvent) {
    event.preventDefault();
    if (!fieldIds.length) {
      setError("Select at least one report field.");
      return;
    }
    setSearching(true);
    setError("");
    setQuery("");
    try {
      const data = await runUserReport({
        fieldIds,
        profileIds,
        employeeIds,
        status,
      });
      setColumns(data.columns);
      setRows(data.rows);
    } catch (value: unknown) {
      setError(
        value instanceof Error
          ? value.message
          : "Report could not be generated."
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">User Report</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose fields and filters, then export the generated report.
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
        onSubmit={generateReport}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Profiles</Label>
            <SearchableMultiSelect
              label="profiles"
              placeholder="All profiles"
              options={profiles}
              values={profileIds}
              onChange={setProfileIds}
            />
          </div>
          <div className="space-y-2">
            <Label>Employees</Label>
            <SearchableMultiSelect
              label="employees"
              placeholder="All employees"
              options={employees}
              values={employeeIds}
              onChange={setEmployeeIds}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-report-status">Status *</Label>
            <select
              id="user-report-status"
              className={controlClass}
              value={status}
              onChange={(event) => setStatus(Number(event.target.value))}
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
        </div>

        <div className="max-h-80 space-y-4 overflow-y-auto rounded-lg border border-slate-200 p-4">
          {loading ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-5 animate-spin" />
              Loading report fields...
            </div>
          ) : groups.length ? (
            groups.map(([group, items]) => {
              const ids = items.map((item) => item.id);
              const allSelected = ids.every((id) =>
                fieldIds.includes(id)
              );
              return (
                <fieldset key={group}>
                  <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                    <legend className="font-semibold text-slate-900">
                      {group}
                    </legend>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setFieldIds((current) =>
                          allSelected
                            ? current.filter((id) => !ids.includes(id))
                            : Array.from(new Set([...current, ...ids]))
                        )
                      }
                    >
                      {allSelected ? "Clear group" : "Select group"}
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {items.map((field) => (
                      <label
                        key={field.id}
                        className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={fieldIds.includes(field.id)}
                          onChange={(event) =>
                            setFieldIds((current) =>
                              event.target.checked
                                ? [...current, field.id]
                                : current.filter((id) => id !== field.id)
                            )
                          }
                          className="size-4 rounded border-slate-300"
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-slate-500">
              No report fields are available.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {fieldIds.length} report field
            {fieldIds.length === 1 ? "" : "s"} selected
          </p>
          <Button type="submit" disabled={searching || loading}>
            {searching ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Generate report
          </Button>
        </div>
      </form>

      {columns.length ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  User distribution
                </h2>
                <p className="text-xs text-slate-500">
                  {visibleRows.length} matching user
                  {visibleRows.length === 1 ? "" : "s"} grouped by{" "}
                  {chartColumn?.label ?? "selected field"}
                </p>
              </div>
              <div className="w-full space-y-2 sm:w-64">
                <Label htmlFor="user-report-chart-field">
                  Chart field
                </Label>
                <select
                  id="user-report-chart-field"
                  className={controlClass}
                  value={effectiveChartKey}
                  onChange={(event) => setChartKey(event.target.value)}
                >
                  {columns.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {chartGroups.length ? (
              <div className="h-72">
                <Bar data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-slate-500">
                No data available for this chart.
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block w-full sm:max-w-md">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-8 pl-8"
                  placeholder="Search report..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!visibleRows.length}
                  onClick={() =>
                    exportRowsAsCsv({
                      filename: "user-report.csv",
                      columns: exportColumns,
                      rows: exportRows,
                    })
                  }
                >
                  <Download className="size-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  disabled={!visibleRows.length}
                  onClick={() =>
                    exportRowsAsExcel({
                      filename: "user-report.xls",
                      title: "User Report",
                      columns: exportColumns,
                      rows: exportRows,
                    })
                  }
                >
                  <FileSpreadsheet className="size-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  disabled={!visibleRows.length}
                  onClick={() =>
                    openPrintPreview({
                      title: "User Report",
                      subtitle: "Generated user data",
                      columns: exportColumns,
                      rows: exportRows,
                    })
                  }
                >
                  <Printer className="size-4" />
                  Print / PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.length ? (
                    visibleRows.map((row, index) => (
                      <TableRow key={index}>
                        {columns.map((column) => (
                          <TableCell key={column.key}>
                            {String(row[column.key] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-slate-500"
                      >
                        No report records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function SearchableMultiSelect({
  label,
  placeholder,
  options,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  values: number[];
  onChange: (values: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedOptions = options.filter((option) =>
    values.includes(option.id)
  );
  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].name
        : `${selectedOptions.length} ${label} selected`;

  function toggle(id: number) {
    onChange(
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id]
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 w-full justify-between rounded-lg px-2.5 font-normal"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-64 gap-2 p-2"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            className="h-8 pl-8"
            placeholder={`Search ${label}...`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange(Array.from(new Set([...values, ...filteredOptions.map((option) => option.id)])))
            }
          >
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {filteredOptions.map((option) => {
            const selected = values.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                <Check
                  className={`size-4 shrink-0 ${selected ? "text-indigo-600" : "invisible"}`}
                />
                <span className="truncate">{option.name}</span>
              </button>
            );
          })}
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-slate-500">
              No {label} found.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
