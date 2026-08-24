"use client";

<<<<<<< HEAD
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bus,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  ExternalLink,
  FileSpreadsheet,
  FolderKanban,
  GraduationCap,
  Library,
  Search,
  Settings2,
  TableProperties,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from "@/components/erp/erp-ui";
import { errorMessage } from "@/lib/erp-legacy";
import { mapApiLinkToRoute } from "@/app/data/routeMapper";
import {
  loadOnboarding,
  type FeesOnboardingData,
  type OnboardingData,
  type OnboardingMenuEntry,
  type OnboardingModule,
} from "./api";

type DetailKind = "module" | "fees" | "transport" | null;
type FeesStep = 1 | 2 | 3 | 4 | 5;
type ModuleStep = 1 | 2;

const EXTRA_CARDS = [
  { menuTitle: "Library", kind: "module" as const },
  { menuTitle: "LMS Preloaded", kind: "module" as const },
];

const ROLE_ORDER = [
  "Admin",
  "Teacher",
  "Student",
  "Parent",
  "Principal",
  "Clerk",
  "Counseller",
  "Lms Teacher",
  "Trustee",
  "Librarian",
  "Peon",
  "Exam Department",
  "Academic Dept.",
];

const HRMS_CREATE_LINKS: Record<string, string> = {
  "Payroll Type": "payroll-type/create",
  "Leave Type Master": "leave-type",
  Designation: "/",
  "Import Leave": "import-leave",
  "Bio Matrix": "settings/biomatrix",
};

const MODULE_PREFIXES: Record<string, string> = {
  Transportation: "transportation/",
  Hostel: "hostel_management/",
  Inventory: "inventory/",
  Transport: "transportation/",
  LMS: "lms/",
  Communication: "easy_com/",
  Result: "result/",
  "Petty Cash": "frontdesk/",
  "Inward-Outward": "inward_outward/",
  PTM: "ptm/",
  School: "school_setup/",
  Student: "student/",
  Utility: "student/",
  Consent: "consent/",
};

const NO_CREATE_NAMES = new Set([
  "Map Optional Subjects",
  "Student Request Type",
  "Transfer Student",
  "Standard Division Mapping",
]);

const SCHOOL_SETUP_NAMES = new Set(["Subject Standard Mapping", "Standard Division Mapping"]);

function totalComplete(module: OnboardingModule): { complete: number; total: number } {
  const all = [...module.master, ...module.entry, ...module.report];
  return {
    complete: all.filter((item) => item.complete).length,
    total: all.length,
  };
}

function getMappedRoute(link: string): string {
  const mapped = mapApiLinkToRoute(link);
  return mapped !== "#" ? mapped : "#";
}

function openOnboardingLink(
  router: ReturnType<typeof useRouter>,
  baseUrl: string,
  link: string
) {
  const route = getMappedRoute(link);
  if (route !== "#") {
    router.push(route);
    return;
  }
  const normalized = link.replace(/^\/+/, "").replace(/\.index$/, "");
  if (!normalized || normalized === "javascript:void(0);" || normalized === "#") {
    return;
  }
  window.open(`${baseUrl}/${normalized}`, "_blank", "noopener,noreferrer");
}

function getLegacyModuleLinks(menuTitle: string, entry: OnboardingMenuEntry) {
  const linkValue = entry.link.trim();
  const name = entry.name.trim();

  if (menuTitle === "HRMS" && HRMS_CREATE_LINKS[name]) {
    return {
      actionLink: HRMS_CREATE_LINKS[name],
      detailLink: HRMS_CREATE_LINKS[name],
    };
  }

  if (name === "SMTP") {
    return {
      actionLink: "settings/smtp_setting/create",
      detailLink: "settings/smtp_setting",
    };
  }

  const createSegment = NO_CREATE_NAMES.has(name)
    ? linkValue.replace(".index", "")
    : linkValue.replace(".index", "/create");
  const detailSegment = linkValue.replace(".index", "");
  const prefix = SCHOOL_SETUP_NAMES.has(name)
    ? "school_setup/"
    : (MODULE_PREFIXES[menuTitle] ?? "");

  return {
    actionLink: `${prefix}${createSegment}`.replace(/^\/+/, ""),
    detailLink: `${prefix}${detailSegment}`.replace(/^\/+/, ""),
  };
}

function ModuleChecklist({
  module,
  router,
  baseUrl,
}: {
  module: OnboardingModule;
  router: ReturnType<typeof useRouter>;
  baseUrl: string;
}) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="border-b">
        <CardTitle className="text-slate-950">Step 1: {module.menuTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="hidden grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:grid">
          <div>Modules</div>
          <div>Details</div>
          <div>Status</div>
        </div>
        <div className="space-y-3">
          {module.master.map((entry) => {
            const links = getLegacyModuleLinks(module.menuTitle, entry);
            return (
              <div
                key={`${module.menuTitle}-${entry.id}-${entry.name}`}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3 md:items-center"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Modules</p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-left text-blue-700"
                    onClick={() => openOnboardingLink(router, baseUrl, links.actionLink)}
                  >
                    {entry.name}
                  </Button>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Details</p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-left text-blue-700"
                    onClick={() => openOnboardingLink(router, baseUrl, links.detailLink)}
                  >
                    View Details
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">Status</p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      entry.complete ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {entry.complete ? <CheckCircle2 className="size-3.5" /> : <CircleOff className="size-3.5" />}
                    {entry.complete ? "Complete" : "Pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleRoles({
  moduleTitle,
  roles,
  selectedRole,
  onSelectRole,
}: {
  moduleTitle: string;
  roles: Record<string, string>;
  selectedRole: string;
  onSelectRole: (value: string) => void;
}) {
  const availableRoles = ROLE_ORDER.filter((role) => roles[role]);

  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-slate-950">
          <UserCog className="size-5 text-blue-600" />
          Roles & Responsibilities
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {availableRoles.length === 0 ? (
          <ErpEmpty title={`No role guidance was returned for ${moduleTitle}.`} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="space-y-2">
              {availableRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onSelectRole(role)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                    selectedRole === role
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
            <div
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
              dangerouslySetInnerHTML={{ __html: roles[selectedRole] || "<p>No role guidance available.</p>" }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeesWizard({
  account,
  fees,
  roles,
  requirements,
  selectedRole,
  setSelectedRole,
  step,
  setStep,
  router,
}: {
  account: OnboardingData["account"];
  fees: FeesOnboardingData;
  roles: Record<string, string>;
  requirements: Record<string, string>;
  selectedRole: string;
  setSelectedRole: (value: string) => void;
  step: FeesStep;
  setStep: (value: FeesStep) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const processHtml = requirements["0"] || "";
  const instituteRequirementHtml =
    Object.entries(requirements).find(([key]) => key !== "0")?.[1] || "";

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-5">
          {[
            "Check Account Details",
            "Fees Setup",
            "Import Data",
            "Roles & Responsibilities",
            "Requirements & Process",
          ].map((label, index) => {
            const current = index + 1 as FeesStep;
            const active = step === current;
            const done = step > current;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(current)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${
                  active
                    ? "border-blue-500 bg-blue-50"
                    : done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Step {current}</p>
                  <p className="font-medium text-slate-900">{label}</p>
                </div>
                {done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <ChevronRight className="size-5 text-slate-400" />}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-5 p-5">
          {step === 1 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Check your Account Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["Account Number", account.accountNumber],
                  ["Creation Date", account.createdAt],
                  ["School Name", account.schoolName],
                  ["User Name", account.userName],
                  ["Mobile", account.mobile],
                  ["Email", account.email],
                  ["First Name", account.firstName],
                  ["Last Name", account.lastName],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 font-medium text-slate-900">{value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Fees Setup</h3>
              <div className="grid gap-3">
                {[
                  {
                    title: "Fees Map Year",
                    detail: `${fees.months.length} months returned by the onboarding API.`,
                    route: "#",
                  },
                  {
                    title: "Fees Title",
                    detail: `${fees.titleOptions.length} fee title options returned.`,
                    route: "/fees/master/new-fees-title-master",
                  },
                  {
                    title: "Fees Config Master",
                    detail: "Open the migrated fee configuration page.",
                    route: "/fees/master/fees-config-master",
                  },
                  {
                    title: "Fees Month Header",
                    detail: `${fees.months.filter((item) => item.header).length} saved month headers found.`,
                    route: "#",
                  },
                  {
                    title: "Fees Receipt Book Master",
                    detail: `${fees.receiptHeads.length} fee head options returned.`,
                    route: "/fees/master/fees-receipt-book-master",
                  },
                  {
                    title: "Fees Breakoff",
                    detail: `${fees.breakoffMonths.length} month options returned.`,
                    route: "/fees/master/fees-breakoff",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.detail}</p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={item.route === "#"}
                      onClick={() => router.push(item.route)}
                    >
                      Open
                      <ExternalLink className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Import Data</h3>
              {fees.importTables.length === 0 ? (
                <ErpEmpty title="No import tables were returned." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {fees.importTables.map((table) => (
                    <div key={table.tableName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-medium text-slate-900">{table.displayName}</p>
                      <p className="mt-1 text-xs text-slate-500">{table.tableName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Roles & Responsibilities</h3>
              <div className="max-w-sm space-y-2">
                <label className="text-sm font-medium text-slate-700">Select profile</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                >
                  {ROLE_ORDER.filter((role) => roles[role]).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                dangerouslySetInnerHTML={{ __html: roles[selectedRole] || "<p>No role guidance available.</p>" }}
              />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Requirements & Process</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 font-medium text-slate-900">Add Your Requirements</p>
                  <div
                    className="prose prose-sm max-w-none text-slate-700"
                    dangerouslySetInnerHTML={{ __html: instituteRequirementHtml || "<p>No institute-specific requirement has been added yet.</p>" }}
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 font-medium text-slate-900">Our Process</p>
                  <div
                    className="prose prose-sm max-w-none text-slate-700"
                    dangerouslySetInnerHTML={{ __html: processHtml || "<p>No process text was returned.</p>" }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((step - 1) as FeesStep)}>
              Back
            </Button>
            <Button disabled={step === 5} onClick={() => setStep((Math.min(5, step + 1)) as FeesStep)}>
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
=======
import type { ReactNode } from "react";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  SkipForward,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type StepOwner = "TRIZ" | "SCHOOL";
type StepStatus =
  | "completed"
  | "in_progress"
  | "pending"
  | "skipped"
  | "blocked"
  | "misconfigured";

/**
 * Presentation tokens for the onboarding journey.
 *
 * Deliberately expressed in the same Tailwind vocabulary the rest of the app
 * already uses (slate borders, rounded-2xl cards, white surfaces — see
 * components/erp/erp-ui.tsx). The ribbon uses the indigo/violet brand ramp the
 * design system already declares as `--action-primary` rather than introducing
 * a new hue.
 *
 * Status is never carried by colour alone: every state pairs a hue with a
 * distinct icon and a text label, per the design system's accessibility rule.
 */

export const STATUS_META: Record<
  StepStatus,
  { label: string; icon: typeof CircleCheck; badge: string; dot: string }
> = {
  completed: {
    label: "Completed",
    icon: CircleCheck,
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  in_progress: {
    label: "In progress",
    icon: CircleDot,
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  pending: {
    label: "Not started",
    icon: CircleDashed,
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-300",
  },
  skipped: {
    label: "Skipped",
    icon: SkipForward,
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  blocked: {
    label: "Blocked",
    icon: Ban,
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  misconfigured: {
    label: "Needs attention",
    icon: TriangleAlert,
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
};

/**
 * Gradient applied to a ribbon segment for each status.
 *
 * Each entry uses the SAME hue family as that status's dot in `STATUS_META`, so
 * the legend describes what the ribbon actually shows. An earlier pass kept the
 * whole band violet to mirror the reference artwork, which made the legend
 * inaccurate — it promised green/blue/grey/amber while every segment rendered
 * violet.
 *
 * Colour is still never the only signal: every segment also carries the status
 * icon and an accessible label.
 *
 * Consumed with `bg-gradient-to-r`, which the caller applies.
 */
export const RIBBON_FILL: Record<StepStatus, string> = {
  completed: "from-emerald-500 to-emerald-600 text-white",
  in_progress: "from-indigo-500 to-indigo-600 text-white",
  pending: "from-slate-300 to-slate-400 text-slate-900",
  skipped: "from-slate-400 to-slate-500 text-white",
  blocked: "from-rose-500 to-rose-600 text-white",
  misconfigured: "from-amber-400 to-amber-500 text-amber-950",
};

/**
 * Colour of the hairpin turns joining the rows of the ribbon. The turns are
 * track, not status, so they stay on the brand violet and read as the thread
 * running through the journey rather than as a step of their own.
 */
export const RIBBON_TURN_COLOR = "#7c3aed"; // violet-600

export const OWNER_META: Record<StepOwner, { label: string; ring: string; text: string }> = {
  TRIZ: {
    label: "scholar admin",
    ring: "border-sky-500 bg-sky-50 text-sky-700",
    text: "text-sky-700",
  },
  SCHOOL: {
    label: "School admin",
    ring: "border-orange-400 bg-orange-50 text-orange-700",
    text: "text-orange-700",
  },
};

export function StatusBadge({ status }: { status: StepStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={`gap-1 ${meta.badge}`}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}

/**
 * The owner marker from the reference design — the small ringed avatar that
 * sits above or below each chevron. `lead` renders the owner that drives the
 * step; the other side is shown muted so both parties stay visible.
 */
export function OwnerMarker({
  owner,
  role,
  lead,
}: {
  owner: StepOwner;
  role?: string;
  lead?: boolean;
}) {
  const meta = OWNER_META[owner];
  const initials = owner === "TRIZ" || owner === "SCHOOL" ? "SA" : "SA";

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold ${meta.ring} ${lead ? "" : "opacity-60"
          }`}
        aria-hidden
      >
        {initials}
      </span>
      <span className={`text-[11px] leading-tight ${lead ? meta.text : "text-slate-400"}`}>
        <span className="font-medium">{meta.label}</span>
        {role ? <span className="block text-slate-400">{role}</span> : null}
      </span>
    </span>
  );
}

/** Compact percentage meter used on module cards and the journey header. */
export function ProgressMeter({
  percent,
  label,
  tone = "brand",
}: {
  percent: number;
  label?: string;
  tone?: "brand" | "neutral";
}) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>{label}</span>
          <span className="font-semibold tabular-nums text-slate-700">{safe}%</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Onboarding progress"}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${tone === "brand" ? "bg-violet-600" : "bg-slate-400"
            }`}
          style={{ width: `${safe}%` }}
        />
      </div>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    </div>
  );
}

<<<<<<< HEAD
export function OnboardingPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [detailKind, setDetailKind] = useState<DetailKind>(null);
  const [selectedModule, setSelectedModule] = useState<OnboardingModule | null>(null);
  const [feesStep, setFeesStep] = useState<FeesStep>(1);
  const [selectedRole, setSelectedRole] = useState("Admin");
  const [moduleStep, setModuleStep] = useState<ModuleStep>(1);
  const [selectedModuleRole, setSelectedModuleRole] = useState("Admin");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const onboarding = await loadOnboarding();
      setData(onboarding);
      if (onboarding.roles.Fees) {
        const firstRole = ROLE_ORDER.find((role) => onboarding.roles.Fees[role]) || Object.keys(onboarding.roles.Fees)[0] || "Admin";
        setSelectedRole(firstRole);
      }
    } catch (value: unknown) {
      setError(errorMessage(value, "Onboarding could not be loaded."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The legacy onboarding aggregate depends on browser-backed ERP session data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const visibleModules = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.modules;
    return data.modules.filter((module) => {
      if (module.menuTitle.toLowerCase().includes(normalized)) return true;
      return [...module.master, ...module.entry, ...module.report].some((item) =>
        item.name.toLowerCase().includes(normalized)
      );
    });
  }, [data, query]);

  function openModule(module: OnboardingModule) {
    const moduleRoles = data?.roles[module.menuTitle] || {};
    const firstRole =
      ROLE_ORDER.find((role) => moduleRoles[role]) ||
      Object.keys(moduleRoles)[0] ||
      "Admin";
    setSelectedModuleRole(firstRole);
    setModuleStep(module.master.length > 0 ? 1 : 2);
    setSelectedModule(module);
    setDetailKind("module");
  }

  if (loading) {
    return (
      <main className="min-h-screen p-4 sm:p-6">
        <div className="mx-auto max-w-[1600px]">
          <ErpLoading label="Loading onboarding..." />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <ErpPageHeader
          title="Onboarding"
          description="Menu-plan onboarding migrated from the old ERP with module completion badges, onboarding steps, roles, and requirement guidance."
          onRefresh={() => void load()}
          refreshing={loading}
        />

        <ErpAlert tone="error">{error}</ErpAlert>
        {data?.source === "fallback" ? (
          <ErpAlert tone="info">
            The old aggregated onboarding endpoint failed, so this page is using a safe fallback built from current menu rights and session data.
          </ErpAlert>
        ) : null}

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Account Number</p>
              <p className="mt-1 font-semibold text-slate-900">{data?.account.accountNumber || "—"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">School Name</p>
              <p className="mt-1 font-semibold text-slate-900">{data?.account.schoolName || "—"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">User Name</p>
              <p className="mt-1 font-semibold text-slate-900">{data?.account.userName || "—"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-1 font-semibold text-slate-900">{data?.account.email || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <ErpSection
          title="Menu Plan"
          description="Choose a module to review its setup path, completion status, and role/process guidance."
          icon={<FolderKanban className="size-5" />}
        >
          <div className="space-y-5">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search menus..." className="pl-9" />
            </div>

            {visibleModules.length === 0 ? (
              <ErpEmpty title="No onboarding menus matched your search." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleModules.map((module) => {
                  const summary = totalComplete(module);
                  return (
                    <button
                      key={module.menuTitle}
                      type="button"
                      onClick={() => openModule(module)}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{module.menuTitle}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {summary.complete} of {summary.total} setup items completed
                          </p>
                        </div>
                        <ChevronRight className="size-5 text-slate-400" />
                      </div>
                    </button>
                  );
                })}
                {EXTRA_CARDS.map((card) => (
                  <div
                    key={card.menuTitle}
                    className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"
                  >
                    <div className="flex items-start gap-3">
                      {card.menuTitle === "Library" ? <Library className="size-5 text-slate-500" /> : <GraduationCap className="size-5 text-slate-500" />}
                      <div>
                        <p className="font-semibold text-slate-900">{card.menuTitle}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Legacy extra menu shown in onboarding.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ErpSection>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-slate-950">
                <Settings2 className="size-5 text-blue-600" />
                Special Onboarding Flows
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => { setDetailKind("fees"); setFeesStep(1); }}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300"
              >
                <p className="font-semibold text-slate-900">Fees Setup</p>
                <p className="mt-1 text-sm text-slate-500">Account details, fees setup, import data, roles, and requirements.</p>
              </button>
              <button
                type="button"
                onClick={() => setDetailKind("transport")}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300"
              >
                <p className="font-semibold text-slate-900">Transportation</p>
                <p className="mt-1 text-sm text-slate-500">Transport onboarding shortcut from the old ERP.</p>
              </button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-slate-950">
                <TableProperties className="size-5 text-blue-600" />
                Data Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Menus</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{data?.modules.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Fee Title Options</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{data?.fees.titleOptions.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Import Tables</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{data?.fees.importTables.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Roles in Fees</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{Object.keys(data?.roles.Fees || {}).length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {detailKind === "module" && selectedModule && data ? (
          <ErpSection
            title={selectedModule.menuTitle}
            description="Old ERP onboarding flow rebuilt in the new design."
            icon={<FolderKanban className="size-5" />}
          >
            <div className="space-y-5">
              {selectedModule.master.length > 0 && moduleStep === 1 ? (
                <ModuleChecklist module={selectedModule} router={router} baseUrl={data.sessionBaseUrl} />
              ) : null}

              {moduleStep === 2 || selectedModule.master.length === 0 ? (
                <ModuleRoles
                  moduleTitle={selectedModule.menuTitle}
                  roles={data.roles[selectedModule.menuTitle] || {}}
                  selectedRole={selectedModuleRole}
                  onSelectRole={setSelectedModuleRole}
                />
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                {selectedModule.master.length > 0 ? (
                  <>
                    <Button variant="outline" disabled={moduleStep === 1} onClick={() => setModuleStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setModuleStep(2)}>
                      {moduleStep === 1 ? "Continue" : "Roles & Responsibilities"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </ErpSection>
        ) : null}

        {detailKind === "fees" && data ? (
          <ErpSection
            title="Fees Onboarding"
            description="Dedicated fees onboarding flow from the old ERP, rebuilt with the new design."
            icon={<FileSpreadsheet className="size-5" />}
          >
            <FeesWizard
              account={data.account}
              fees={data.fees}
              roles={data.roles.Fees || {}}
              requirements={data.requirements.Fees || {}}
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              step={feesStep}
              setStep={setFeesStep}
              router={router}
            />
          </ErpSection>
        ) : null}

        {detailKind === "transport" && data ? (
          <ErpSection
            title="Transportation Onboarding"
            description="Old ERP transport onboarding shortcut."
            icon={<Bus className="size-5" />}
          >
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex flex-col gap-5 p-6 text-center">
                <div className="mx-auto rounded-full bg-blue-50 p-4 text-blue-600">
                  <Bus className="size-8" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">Transportation</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Continue into the transport onboarding flow or open the migrated transportation setup pages.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => window.open(`${data.sessionBaseUrl}/transport_Onboarding`, "_blank", "noopener,noreferrer")}>
                    Get Started
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/Transportation/transportation")}>
                    Open Transportation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ErpSection>
        ) : null}
      </div>
    </main>
=======
export function OnboardingLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
      <OwnerMarker owner="TRIZ" lead />
      <OwnerMarker owner="SCHOOL" lead />
      <span className="h-4 w-px bg-slate-200" aria-hidden />
      {(["completed", "in_progress", "pending", "misconfigured"] as StepStatus[]).map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${STATUS_META[status].dot}`} aria-hidden />
          {STATUS_META[status].label}
        </span>
      ))}
    </div>
  );
}

export function OnboardingPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  );
}
