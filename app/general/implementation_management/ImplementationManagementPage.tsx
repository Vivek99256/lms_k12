"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  ExternalLink,
  FileSpreadsheet,
  GraduationCap,
  LoaderCircle,
  Save,
  School2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  ErpAlert,
  ErpEmpty,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
} from "@/components/erp/erp-ui";
import { errorMessage } from "@/lib/erp-legacy";
import { buildSessionContext } from "@/lib/erp-client";
import { mapApiLinkToRoute } from "@/app/data/routeMapper";
import {
  loadImplementationManagement,
  loadImplementationWelcome,
  saveImplementationManagement,
  type ImplementationManagementData,
  type ImplementationStrengthRow,
  type ImplementationWelcomeData,
} from "./api";

type TotalsForm = {
  totalBoys: string;
  totalGirls: string;
  totalStrength: string;
  totalMale: string;
  totalFemale: string;
};

type ProgressStatus = "complete" | "incomplete";
type ImplementationView = "welcome" | "overview" | "details";

type ProgressAction =
  | { kind: "internal"; href: string }
  | { kind: "legacy"; path: string }
  | { kind: "external"; href: string };

type ProgressItem = {
  title: string;
  helper: string;
  status: ProgressStatus;
  action: ProgressAction;
};

type ProgressStage = {
  id: number;
  label: string;
  title: string;
  summaryPercent?: number;
  items: ProgressItem[];
};

const PROGRESS_STAGES: ProgressStage[] = [
  { id: 0, label: "Welcome", title: "Getting started to TRIZ ERP", items: [] },
  {
    id: 1,
    label: "Data",
    title: "Upload Data",
    summaryPercent: 100,
    items: [
      {
        title: "Staff Data",
        helper: "Download the legacy Excel template for staff import.",
        status: "complete",
        action: {
          kind: "external",
          href: "http://apps.triz.co.in/excel_upload/export_xlsx.php?module=tbluser",
        },
      },
      {
        title: "Student Data",
        helper: "Download the legacy Excel template for student import.",
        status: "complete",
        action: {
          kind: "external",
          href: "http://apps.triz.co.in/excel_upload/export_xlsx.php?module=tblstudent",
        },
      },
    ],
  },
  {
    id: 2,
    label: "Fees",
    title: "Fees Setup",
    summaryPercent: 20,
    items: [
      {
        title: "Fees Title",
        helper: "Maintain fee titles.",
        status: "complete",
        action: { kind: "internal", href: mapApiLinkToRoute("fees_title.index") },
      },
      {
        title: "Fees Map",
        helper: "Open the legacy fees map setup.",
        status: "complete",
        action: { kind: "legacy", path: "map_year?implementation=1" },
      },
      {
        title: "Fees Structure",
        helper: "Maintain fee breakoff structure.",
        status: "complete",
        action: { kind: "internal", href: mapApiLinkToRoute("fees_breackoff.index") },
      },
      {
        title: "Fees Receipt",
        helper: "Maintain receipt setup.",
        status: "complete",
        action: {
          kind: "internal",
          href: mapApiLinkToRoute("fees_receipt_book_master.index"),
        },
      },
      {
        title: "Fees Collect",
        helper: "Continue into the legacy fee collection flow.",
        status: "complete",
        action: { kind: "legacy", path: "fees_collect?implementation=1" },
      },
    ],
  },
  {
    id: 3,
    label: "Result",
    title: "Result",
    summaryPercent: 50,
    items: [
      {
        title: "Exam Type Master",
        helper: "Maintain exam types.",
        status: "incomplete",
        action: { kind: "internal", href: mapApiLinkToRoute("exam_type_master.index") },
      },
      {
        title: "Create Exam",
        helper: "Continue into exam creation.",
        status: "complete",
        action: { kind: "internal", href: mapApiLinkToRoute("exam_creation.index") },
      },
      {
        title: "Grade Scale Master",
        helper: "Maintain grade scales.",
        status: "complete",
        action: { kind: "internal", href: mapApiLinkToRoute("grade_master.index") },
      },
      {
        title: "Result Format",
        helper: "Maintain result format.",
        status: "complete",
        action: { kind: "internal", href: mapApiLinkToRoute("result_master.index") },
      },
    ],
  },
  {
    id: 4,
    label: "Report",
    title: "Report View",
    summaryPercent: 100,
    items: [
      {
        title: "Report Getting Started",
        helper: "Open the report setup screen.",
        status: "incomplete",
        action: { kind: "internal", href: mapApiLinkToRoute("student_report.index") },
      },
      {
        title: "Report Fields",
        helper: "Continue into report fields from the same report screen.",
        status: "complete",
        action: { kind: "internal", href: mapApiLinkToRoute("student_report.index") },
      },
    ],
  },
  {
    id: 5,
    label: "Rights",
    title: "Rights",
    summaryPercent: 100,
    items: [
      {
        title: "Groupwise Rights",
        helper: "Assign permissions profile-wise.",
        status: "incomplete",
        action: { kind: "internal", href: "/general/groupwise_rights" },
      },
      {
        title: "Individual Rights",
        helper: "Assign user-level rights overrides.",
        status: "complete",
        action: { kind: "internal", href: "/general/individual_rights" },
      },
    ],
  },
];

function numberText(value: string): string {
  return /^\d*$/.test(value) ? value : value.replace(/\D/g, "");
}

function count(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rowTotal(row: Pick<ImplementationStrengthRow, "boys" | "girls">): string {
  return String(count(row.boys) + count(row.girls));
}

function emptyState(): ImplementationManagementData {
  return {
    totalBoys: "",
    totalGirls: "",
    totalStrength: "",
    totalMale: "",
    totalFemale: "",
    finalStdTotalBoys: "",
    finalStdTotalGirls: "",
    finalStdTotal: "",
    rows: [],
  };
}

export function ImplementationManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ImplementationManagementData>(emptyState);
  const [welcome, setWelcome] = useState<ImplementationWelcomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [welcomeData, implementationData] = await Promise.all([
        loadImplementationWelcome(),
        loadImplementationManagement(),
      ]);
      setWelcome(welcomeData);
      setData(implementationData);
    } catch (value: unknown) {
      setError(errorMessage(value, "Implementation Management could not be loaded."));
      setWelcome(null);
      setData(emptyState());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage holds the ERP session, so module bootstrap runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const currentView = useMemo<ImplementationView>(() => {
    const value = searchParams.get("view");
    if (value === "welcome" || value === "overview" || value === "details") return value;
    return "welcome";
  }, [searchParams]);

  const selectedStageId = useMemo(() => {
    const value = Number(searchParams.get("moduleId") || "1");
    return Number.isFinite(value) && value >= 1 && value <= 5 ? value : 1;
  }, [searchParams]);

  const selectedStage = useMemo(
    () => PROGRESS_STAGES.find((stage) => stage.id === selectedStageId) ?? PROGRESS_STAGES[1],
    [selectedStageId]
  );

  const standardSummary = useMemo(() => {
    const totalBoys = data.rows.reduce((sum, row) => sum + count(row.boys), 0);
    const totalGirls = data.rows.reduce((sum, row) => sum + count(row.girls), 0);
    return { totalBoys, totalGirls, total: totalBoys + totalGirls };
  }, [data.rows]);

  const session = useMemo(() => buildSessionContext(), []);

  function setView(view: ImplementationView, moduleId = selectedStageId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    params.set("moduleId", String(moduleId));
    router.replace(`/general/implementation_management?${params.toString()}`);
  }

  function formatDate(value: string): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB").format(date);
  }

  function openProgressAction(action: ProgressAction) {
    if (action.kind === "internal") {
      router.push(action.href);
      return;
    }
    const href =
      action.kind === "external"
        ? action.href
        : `${session.baseUrl.replace(/\/$/, "")}/${action.path.replace(/^\//, "")}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function updateTotals(field: keyof TotalsForm, value: string) {
    const nextValue = numberText(value);
    setData((current) => {
      const next = { ...current, [field]: nextValue };
      next.totalStrength = String(
        count(field === "totalBoys" ? nextValue : current.totalBoys) +
          count(field === "totalGirls" ? nextValue : current.totalGirls)
      );
      return next;
    });
  }

  function updateRow(index: number, field: "boys" | "girls", value: string) {
    const nextValue = numberText(value);
    setData((current) => {
      const rows = current.rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const nextRow = { ...row, [field]: nextValue };
        return { ...nextRow, total: rowTotal(nextRow) };
      });
      return { ...current, rows };
    });
  }

  function validate(): string {
    if (!data.totalBoys.trim()) return "Total Boys is required.";
    if (!data.totalGirls.trim()) return "Total Girls is required.";
    if (!data.totalMale.trim()) return "Total Male Staff is required.";
    if (!data.totalFemale.trim()) return "Total Female Staff is required.";
    if (count(data.totalStrength) !== count(data.totalBoys) + count(data.totalGirls)) {
      return "Total Strength must equal Total Boys plus Total Girls.";
    }
    if (data.rows.length === 0) return "No institute standards were returned by the API.";
    return "";
  }

  async function save() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      setNotice(
        await saveImplementationManagement({
          ...data,
          finalStdTotalBoys: String(standardSummary.totalBoys),
          finalStdTotalGirls: String(standardSummary.totalGirls),
          finalStdTotal: String(standardSummary.total),
        })
      );
      await load();
    } catch (value: unknown) {
      setError(errorMessage(value, "Implementation Management could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Implementation Management"
        description="Reproduces the old ERP implementation journey and institute-strength setup using the new ERP design."
        onRefresh={() => void load()}
        refreshing={loading || saving}
        actions={
          <Button onClick={() => void save()} disabled={loading || saving || data.rows.length === 0}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        }
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <ErpSection
        title="Progress of Implementation"
        description="Welcome, overview cards, and detailed stage flow recreated from the old ERP implementation journey."
        icon={<GraduationCap className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading implementation progress..." />
        ) : (
          <div className="space-y-5">
            {currentView === "welcome" ? (
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="bg-slate-900 px-6 py-6 text-center text-white">
                  <h3 className="text-3xl font-semibold">Getting started to TRIZ ERP</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Alright, let&apos;s set this up! Tell us a bit about yourself.
                  </p>
                </div>
                <CardContent className="space-y-6 p-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Account Number</p>
                      <p className="mt-1 font-semibold text-slate-900">{welcome?.accountNumber || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Creation Date</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatDate(welcome?.creationDate || "")}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">School Name</p>
                      <p className="mt-1 font-semibold text-slate-900">{welcome?.schoolName || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">User Name</p>
                      <p className="mt-1 font-semibold text-slate-900">{welcome?.userName || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Mobile</p>
                      <p className="mt-1 font-semibold text-slate-900">{welcome?.mobile || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                      <p className="mt-1 font-semibold text-slate-900">{welcome?.email || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">First Name</p>
                      <p className="mt-1 font-semibold text-slate-900">{welcome?.firstName || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Last Name</p>
                      <p className="mt-1 font-semibold text-slate-900">{welcome?.lastName || "—"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button onClick={() => setView("details", 1)}>Continue</Button>
                    <Button variant="outline" onClick={() => router.push("/")}>Skip</Button>
                    <Button variant="outline" onClick={() => setView("overview", 1)}>
                      View Overview
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {currentView === "overview" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {PROGRESS_STAGES.filter((stage) => stage.summaryPercent != null).map((stage) => (
                    <Card key={stage.id} className="border-slate-200 shadow-sm">
                      <CardContent className="space-y-3 p-5">
                        <p className="text-base font-semibold text-slate-900">{stage.title}</p>
                        <button
                          type="button"
                          className="text-sm text-blue-600 hover:underline"
                          onClick={() => setView("details", stage.id)}
                        >
                          Setup Now
                        </button>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Progress</span>
                          <span className="font-semibold text-slate-900">{stage.summaryPercent}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${stage.summaryPercent}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setView("welcome", 1)}>
                    Back to Welcome
                  </Button>
                  <Button onClick={() => setView("details", 1)}>
                    Open Detail Flow
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {currentView === "details" ? (
              <div className="space-y-5">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold text-slate-900">
                          Welcome to TRIZ ERP, {welcome?.firstName || welcome?.userName || "User"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          You&apos;re almost there.
                          <button
                            type="button"
                            className="ml-1 text-blue-600 hover:underline"
                            onClick={() => setView("details", 1)}
                          >
                            Implementation
                          </button>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setView("overview", selectedStage.id)}>
                          Overview
                        </Button>
                        <Button variant="outline" onClick={() => setView("welcome", selectedStage.id)}>
                          Welcome
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="flex min-w-max items-center gap-3">
                        {PROGRESS_STAGES.map((stage, index) => {
                          const active = stage.id === selectedStage.id;
                          const complete = stage.id < selectedStage.id;
                          return (
                            <div key={stage.id} className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setView("details", stage.id === 0 ? 1 : stage.id)}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                  active
                                    ? "bg-blue-600 text-white"
                                    : complete
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {stage.label}
                              </button>
                              {index < PROGRESS_STAGES.length - 1 ? (
                                <div className="h-px w-8 bg-slate-300" />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {selectedStage.label}
                        </p>
                        <h3 className="text-xl font-semibold text-slate-950">{selectedStage.title}</h3>
                      </div>
                      {selectedStage.id === 5 ? (
                        <Button variant="outline" onClick={() => router.push("/")}>
                          Finish
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setView("details", Math.min(5, selectedStage.id + 1))}
                        >
                          Next
                          <ChevronRight className="size-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3">
                      {selectedStage.items.map((item, index) => (
                        <div
                          key={`${selectedStage.id}-${item.title}`}
                          className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.2fr_0.7fr_auto]"
                        >
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">
                              {index + 1}) {item.title}
                            </p>
                            <p className="text-sm text-slate-500">{item.helper}</p>
                          </div>
                          <div className="flex items-center text-sm text-slate-500">Tutorial</div>
                          <div className="flex items-center justify-between gap-3 md:justify-end">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                item.status === "complete"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {item.status === "complete" ? (
                                <CheckCircle2 className="size-3.5" />
                              ) : (
                                <CircleOff className="size-3.5" />
                              )}
                              {item.status === "complete" ? "Complete" : "Pending"}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => openProgressAction(item.action)}>
                              {item.action.kind === "external" ? (
                                <FileSpreadsheet className="size-4" />
                              ) : item.action.kind === "legacy" ? (
                                <ExternalLink className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                              Open
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        )}
      </ErpSection>

      <ErpSection
        title="Institute Strength"
        description="These totals are stored once and applied across every standard row, matching the legacy implementation screen."
        icon={<School2 className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading implementation totals..." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="total_boys">Total Boys *</Label>
              <Input
                id="total_boys"
                value={data.totalBoys}
                onChange={(event) => updateTotals("totalBoys", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_girls">Total Girls *</Label>
              <Input
                id="total_girls"
                value={data.totalGirls}
                onChange={(event) => updateTotals("totalGirls", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_strenght">Total Strength</Label>
              <Input id="total_strenght" value={data.totalStrength} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_male">Total Male Staff *</Label>
              <Input
                id="total_male"
                value={data.totalMale}
                onChange={(event) => updateTotals("totalMale", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_female">Total Female Staff *</Label>
              <Input
                id="total_female"
                value={data.totalFemale}
                onChange={(event) => updateTotals("totalFemale", event.target.value)}
              />
            </div>
          </div>
        )}
      </ErpSection>

      <ErpSection
        title="Standard Wise Strength"
        description="Only standards returned by the institute setup are listed, and each row keeps the same boys, girls, and total behavior as the old ERP."
        icon={<Users className="size-5" />}
        footer={
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>Standard Boys: {standardSummary.totalBoys}</span>
            <span>Standard Girls: {standardSummary.totalGirls}</span>
            <span>Standard Total: {standardSummary.total}</span>
          </div>
        }
      >
        {loading ? (
          <ErpLoading label="Loading institute standards..." />
        ) : data.rows.length === 0 ? (
          <ErpEmpty
            title="No standards are available for this institute."
            hint="The old ERP only renders rows for standards already configured under institute setup."
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Standard</TableHead>
                    <TableHead className="w-[180px]">Total Boys</TableHead>
                    <TableHead className="w-[180px]">Total Girls</TableHead>
                    <TableHead className="w-[180px]">Total Strength</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row, index) => (
                    <TableRow key={row.standardId}>
                      <TableCell className="font-medium text-slate-900">{row.standardName}</TableCell>
                      <TableCell>
                        <Input
                          value={row.boys}
                          onChange={(event) => updateRow(index, "boys", event.target.value)}
                          aria-label={`${row.standardName} boys`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.girls}
                          onChange={(event) => updateRow(index, "girls", event.target.value)}
                          aria-label={`${row.standardName} girls`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input value={row.total} readOnly aria-label={`${row.standardName} total strength`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                    <BarChart3 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Standards Listed</p>
                    <p className="text-xl font-semibold text-slate-900">{data.rows.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Institute Total Strength</p>
                  <p className="text-xl font-semibold text-slate-900">{count(data.totalStrength)}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm text-slate-500">Standard-wise Total Strength</p>
                  <p className="text-xl font-semibold text-slate-900">{standardSummary.total}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </ErpSection>
    </main>
  );
}
