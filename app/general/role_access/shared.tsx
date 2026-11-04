"use client";

import { erpSelectClass } from "@/components/erp/erp-ui";
import type { RightKey, Rights, Role } from "./api";

/** The columns of the rights table, in order: the four web rights, then Dashboard and Mobile. */
export const RIGHT_KEYS: Array<{ key: RightKey; label: string; letter: string }> = [
  { key: "view", label: "View", letter: "V" },
  { key: "add", label: "Add", letter: "A" },
  { key: "edit", label: "Edit", letter: "E" },
  { key: "delete", label: "Delete", letter: "D" },
  { key: "dashboard", label: "Dashboard", letter: "B" },
  { key: "mobile", label: "Mobile", letter: "M" },
];

/** The four web rights; Dashboard and Mobile are extras on the same row. */
export const WEB_KEYS = RIGHT_KEYS.slice(0, 4);

export const NO_RIGHTS: Rights = { view: false, add: false, edit: false, delete: false, dashboard: false, mobile: false };
/** Every web right. Dashboard and Mobile are left as they are by whoever applies this. */
export const FULL_RIGHTS: Rights = { view: true, add: true, edit: true, delete: true, dashboard: false, mobile: false };

/** Select All turns on the four web rights and leaves the Dashboard and Mobile flags as they were. */
export function fullKeepingExtras(current: Rights): Rights {
  return { ...FULL_RIGHTS, dashboard: current.dashboard, mobile: current.mobile };
}

/** Whether the role can open the menu at all. Dashboard and Mobile need View, so they are never alone. */
export function hasAny(rights: Rights): boolean {
  return rights.view || rights.add || rights.edit || rights.delete;
}

export function sameRights(a: Rights, b: Rights): boolean {
  return RIGHT_KEYS.every((r) => a[r.key] === b[r.key]);
}

/**
 * Doing anything to a menu needs seeing it, so ticking add / edit / delete / dashboard / mobile
 * ticks view, and clearing view clears the rest. The server enforces the first half as well.
 */
export function withToggle(current: Rights, key: RightKey, on: boolean): Rights {
  const next = { ...current, [key]: on };
  if (key === "view" && !on) return { ...NO_RIGHTS };
  if (on && key !== "view") next.view = true;
  return next;
}

/** V A E D, with the letters the role holds lit, then a small pill for Dashboard / Mobile when set. */
export function RightsChips({ rights }: { rights: Rights }) {
  if (!hasAny(rights)) {
    return <span className="text-xs text-muted-foreground">no access</span>;
  }
  return (
    <span className="inline-flex items-center gap-1" aria-label={RIGHT_KEYS.filter((r) => rights[r.key]).map((r) => r.label).join(", ")}>
      <span className="inline-flex gap-0.5">
        {WEB_KEYS.map((r) => (
          <span
            key={r.key}
            className={`inline-flex size-5 items-center justify-center rounded text-[11px] font-semibold ${
              rights[r.key] ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/40"
            }`}
          >
            {r.letter}
          </span>
        ))}
      </span>
      {rights.dashboard ? <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Dashboard</span> : null}
      {rights.mobile ? <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">Mobile</span> : null}
    </span>
  );
}

export function RoleSelect({
  id,
  roles,
  value,
  onChange,
  placeholder = "Select a role",
  exclude,
  disabled,
}: {
  id: string;
  roles: Role[];
  value: number;
  onChange: (id: number) => void;
  placeholder?: string;
  exclude?: number;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      className={erpSelectClass}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      <option value={0}>{placeholder}</option>
      {roles
        .filter((role) => role.id !== exclude)
        .map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
            {role.protected ? " (admin role)" : ""}
          </option>
        ))}
    </select>
  );
}

export function formatWhen(value: string): string {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The header strip every tab in the right-hand card starts with, the same shape as the
 * Organization Management "Role and Permissions" screen: a large title, a line of help text and
 * the tab's main action on the right.
 */
export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[104px] shrink-0 items-center justify-between gap-4 border-b bg-muted/10 px-6 py-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A thin message strip under the header, in the same style as that screen's error strip. */
export function Strip({ tone, children }: { tone: "error" | "success" | "warning"; children: React.ReactNode }) {
  if (!children) return null;
  const toneClass =
    tone === "error"
      ? "border-destructive/20 bg-destructive/5 text-destructive"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return <div className={`shrink-0 whitespace-pre-line border-b px-6 py-3 text-sm ${toneClass}`}>{children}</div>;
}

export const scrollBody = "min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-6";
