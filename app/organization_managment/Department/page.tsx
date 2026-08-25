"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/app/components/utils/api_url";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Eye,
  Filter,
  Folder,
  FolderOpen,
  Info,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import PoliciesModule from "./Component/polices";
import RulesModule from "./Component/rules";
import SopsModule from "./Component/sops";
import { DepartmentCreateWizard } from "./Component/department-create-wizard";
import { DepartmentEmployeesPanel } from "./Component/department-employees-panel";
import { DepartmentJobRolesPanel } from "./Component/department-job-roles-panel";
import { DepartmentEditDialog } from "./Component/department-edit-dialog";
import { HeadOfDepartmentPicker } from "./Component/head-of-department-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buildSessionContext } from "@/lib/erp-client";
import {
  deleteDepartment,
  getDepartmentEmployees,
  getDepartmentImpact,
  mergeDepartments,
  reorderDepartments,
  setDepartmentHead,
  type DepartmentImpact,
} from "../_lib/department-management-api";
import type { PickerEmployee } from "./Component/head-of-department-picker";

type DepartmentStatus = "Active" | "Inactive" | "Pending";
type SortKey = "name" | "code" | "parent" | "head" | "employees" | "status";

const PAGE_SIZE = 10;
const BREADCRUMB = [
  "Home",
  "Organizational Management",
  "Organization Setup",
  "Department Management",
];

type Employee = {
  id: number;
  employee_no: string;
  gender: string;
  image: string;
  name: string;
  mobile: string;
  department_id: number;
};

type SubDepartment = {
  id: number;
  name: string;
  total_employees: number;
  employees: Employee[];
  sub_departments: SubDepartment[];
};

type Department = {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  sort_order?: number;
  parent_id?: number;
  head_user_id?: number | null;
  total_employees: number;
  employees: Employee[];
  sub_departments: SubDepartment[];
};

type HierarchyResponse = {
  status_code?: number | string;
  message?: string;
  departments?: Department[];
  data?: Department[] | { departments?: Department[] };
};

type DepartmentView = {
  id: string;
  apiId: number;
  name: string;
  shortName: string;
  code: string;
  parentId: number;
  sortOrder: number;
  parent: string;
  head: string;
  title: string;
  employees: number;
  status: DepartmentStatus;
  description: string;
  createdOn: string;
  updatedOn: string;
  employees_list: Employee[];
  sub_departments: SubDepartment[];
};

type HierarchyNode = {
  id: string;
  name: string;
  count: number;
  kind: "department" | "sub" | "employee";
  children?: HierarchyNode[];
};

type ListRow = {
  id: string;
  apiId: number;
  name: string;
  code: string;
  /** Immediate parent's backend id, or 0 for a top-level department. */
  parentApiId: number;
  parent: string;
  head: string;
  title: string;
  employees: number;
  status: DepartmentStatus;
  description: string;
  createdOn: string;
  updatedOn: string;
  employees_list: Employee[];
  sub_departments: SubDepartment[];
};

const tabs = ["Overview", "Employees", "Job Roles", "SOPs", "Policies", "Rules"];

type DepartmentSession = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
};

function readString(value: unknown): string {
  return typeof value === "string"
    ? value
    : value == null
      ? ""
      : String(value);
}

function getDepartmentSession(): DepartmentSession {
  if (typeof window === "undefined") {
    return { baseUrl: API_BASE_URL, token: "", subInstituteId: "" };
  }

  try {
    const userData = JSON.parse(
      localStorage.getItem("userData") || "{}"
    ) as Record<string, unknown>;
    const menuContext = JSON.parse(
      localStorage.getItem("menuContext") || "{}"
    ) as Record<string, unknown>;

    return {
      baseUrl: readString(userData.host_name) || API_BASE_URL,
      token: readString(
        userData.user_token ??
          userData.token ??
          menuContext.user_token ??
          menuContext.token
      ),
      subInstituteId: readString(
        userData.sub_institute_id ?? menuContext.sub_institute_id
      ),
    };
  } catch {
    return { baseUrl: API_BASE_URL, token: "", subInstituteId: "" };
  }
}

function buildDepartmentsUrl(session: DepartmentSession): string {
  const base = session.baseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/api/departments/hierarchy`);
  url.searchParams.set("type", "API");
  if (session.subInstituteId) {
    url.searchParams.set("sub_institute_id", session.subInstituteId);
  }
  return url.toString();
}

function resolveDepartments(payload: unknown): Department[] {
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.departments)) {
    return record.departments as Department[];
  }

  const data = record.data;
  if (Array.isArray(data)) {
    return data as Department[];
  }

  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).departments)) {
    return (data as { departments: Department[] }).departments;
  }

  if (Array.isArray(payload)) {
    return payload as Department[];
  }

  return [];
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      {BREADCRUMB.map((item, index) => (
        <span key={item} className="flex items-center gap-1.5">
          {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
          <span className={index === BREADCRUMB.length - 1 ? "font-medium text-foreground" : undefined}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

function SearchField({
  value,
  onChange,
  className,
  placeholder = "Search department...",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-md bg-background pl-9"
      />
    </div>
  );
}

function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function hierarchyMatches(node: HierarchyNode, query: string): boolean {
  if (!query) return true;
  return (
    node.name.toLowerCase().includes(query) ||
    (node.children ?? []).some((child) => hierarchyMatches(child, query))
  );
}

function HierarchyItem({
  node,
  level,
  collapsedIds,
  selectedId,
  query,
  onToggle,
  onSelect,
}: {
  node: HierarchyNode;
  level: number;
  collapsedIds: Set<string>;
  selectedId: string;
  query: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const selected = node.id === selectedId;
  const hasChildren = Boolean(node.children?.length);
  const collapsed = collapsedIds.has(node.id);
  const isEmployee = node.kind === "employee";
  const normalizedQuery = query.trim().toLowerCase();
  const childMatches = (node.children ?? []).some((child) =>
    hierarchyMatches(child, normalizedQuery)
  );
  const visible =
    !normalizedQuery || node.name.toLowerCase().includes(normalizedQuery) || childMatches;

  if (!visible) return null;

  const open = hasChildren && !collapsed;

  return (
    <div>
      <div
        className={cn(
          "group flex h-9 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium",
          isEmployee
            ? "text-muted-foreground"
            : selected
              ? "bg-blue-50 text-blue-600"
              : "text-foreground hover:bg-muted"
        )}
        style={{ paddingLeft: `${8 + level * 15}px` }}
      >
        <button
          type="button"
          aria-label={collapsed ? "Expand" : "Collapse"}
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            hasChildren ? "text-muted-foreground hover:text-blue-600" : "invisible"
          )}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </button>
        {isEmployee ? (
          <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : open ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        )}
        <button
          type="button"
          onClick={() => !isEmployee && onSelect(node.id)}
          className="min-w-0 flex-1 truncate text-left"
        >
          {node.name}
        </button>
        <Badge variant="secondary" className="rounded-md px-2">
          {node.count}
        </Badge>
        {selected && !isEmployee ? (
          <MoreVertical className="h-3.5 w-3.5 shrink-0 text-foreground" />
        ) : (
          <span className="w-3.5" />
        )}
      </div>
      {hasChildren && (open || childMatches) ? (
        <div className="ml-4 space-y-0.5 border-l border-dotted border-blue-200 py-0.5">
          {node.children?.map((child) => (
            <HierarchyItem
              key={child.id}
              node={child}
              level={level + 1}
              collapsedIds={collapsedIds}
              selectedId={selectedId}
              query={query}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FooterIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 items-center justify-center border border-border bg-background text-foreground transition-colors first:rounded-l-md last:rounded-r-md hover:bg-muted"
    >
      {icon}
    </button>
  );
}

function SortHead({
  label,
  sortKey,
  activeKey,
  asc,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 normal-case text-foreground"
      >
        {label}
        {activeKey === sortKey ? (
          <ChevronDown className={cn("h-3 w-3 transition-transform", asc && "rotate-180")} />
        ) : null}
      </button>
    </TableHead>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Person({ name, title }: { name: string; title: string }) {
  const unassigned = name === "-";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {unassigned ? "UA" : initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium text-foreground">
          {unassigned ? "Unassigned" : name}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {unassigned ? "No HOD" : title || "Department Head"}
        </span>
      </span>
    </div>
  );
}

function IconAction({
  label,
  icon,
  className,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted",
        className
      )}
    >
      {icon}
    </button>
  );
}

function RowMenu({
  isSubDepartment,
  onEdit,
  onAddSubDepartment,
  onAssignHod,
  onDelete,
}: {
  isSubDepartment: boolean;
  onEdit: () => void;
  onAddSubDepartment: () => void;
  onAssignHod: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Department actions"
        onClick={(event) => event.stopPropagation()}
        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-muted"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-lg">
        <DropdownMenuItem>
          <Eye className="h-3.5 w-3.5" />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit {isSubDepartment ? "sub-department" : "department"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddSubDepartment}>
          <Plus className="h-3.5 w-3.5" />
          Add sub-department
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAssignHod}>
          <UserPlus className="h-3.5 w-3.5" />
          Assign / change HOD
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Remove {isSubDepartment ? "sub-department" : "department"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Windows the page-number strip to at most 7 slots (first, last, the current
 * page's neighbours, and "…" for the gaps) instead of one button per page —
 * with dozens of pages the unwindowed list overflowed its footer bar.
 */
function getPaginationItems(current: number, total: number): (number | "ellipsis")[] {
  const siblingCount = 1;
  const totalVisible = siblingCount * 2 + 5;

  if (total <= totalVisible) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, index) => index + 1);
    return [...leftRange, "ellipsis", total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: rightCount }, (_, index) => total - rightCount + index + 1);
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, index) => leftSibling + index
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}

function DetailLine({
  icon,
  label,
  value,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_70px] items-start gap-3 py-2">
      <span className="mt-0.5 flex h-4 w-4 items-center justify-center text-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-foreground">
          {value}
        </p>
      </div>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 text-right text-[9px] font-medium text-blue-600"
        >
          {action}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function getHeadInfo(employees: Employee[]): Pick<DepartmentView, "head" | "title"> {
  const head = employees[0]?.name?.trim();
  return {
    head: head || "-",
    title: head ? "Department Lead" : "",
  };
}

function directEmployeeCount(employees: Employee[] | undefined, fallback: number): number {
  return employees && employees.length > 0 ? employees.length : fallback;
}

function subDepartmentEmployeeTotal(subDepartment: SubDepartment): number {
  return (
    directEmployeeCount(subDepartment.employees, subDepartment.total_employees ?? 0) +
    (subDepartment.sub_departments ?? []).reduce(
      (total, child) => total + subDepartmentEmployeeTotal(child),
      0
    )
  );
}

function mapSubDepartmentNode(
  departmentId: string,
  subDepartment: SubDepartment,
  parentPath = ""
): HierarchyNode {
  const id = parentPath
    ? `${parentPath}-s-${subDepartment.id}`
    : `${departmentId}-s-${subDepartment.id}`;
  const children = (subDepartment.sub_departments ?? []).map((child) =>
    mapSubDepartmentNode(departmentId, child, id)
  );

  return {
    id,
    name: subDepartment.name,
    count: subDepartmentEmployeeTotal(subDepartment),
    kind: "sub",
    children: children.length ? children : undefined,
  };
}

function buildHierarchy(departments: DepartmentView[]): HierarchyNode[] {
  const mapNode = (
    name: string,
    count: number,
    id: string,
    kind: HierarchyNode["kind"],
    children?: HierarchyNode[]
  ): HierarchyNode => ({
    id,
    name,
    count,
    kind,
    children: children && children.length ? children : undefined,
  });

  return departments.map((department) => {
    const children = (department.sub_departments ?? []).map((sub) =>
      mapSubDepartmentNode(department.id, sub)
    );
    const descendantEmployees = (department.sub_departments ?? []).reduce(
      (total, sub) => total + subDepartmentEmployeeTotal(sub),
      0
    );

    return mapNode(
      department.name,
      directEmployeeCount(department.employees_list, department.employees) +
        descendantEmployees,
      department.id,
      "department",
      children
    );
  });
}

function buildListRows(departments: DepartmentView[]): ListRow[] {
  const rows: ListRow[] = [];

  const addSub = (
    deptId: string,
    subs: SubDepartment[],
    parentName: string,
    parentApiId: number,
    parentPath = ""
  ) => {
    for (const sub of subs) {
      const id = parentPath ? `${parentPath}-s-${sub.id}` : `${deptId}-s-${sub.id}`;
      const employees = sub.employees ?? [];
      const headInfo = getHeadInfo(employees);
      rows.push({
        id,
        apiId: sub.id,
        name: sub.name,
        code: `SD-${sub.id}`,
        parentApiId,
        parent: parentName,
        head: headInfo.head,
        title: headInfo.title,
        employees: sub.total_employees ?? 0,
        status: "Active",
        description: `${sub.name} operates under ${parentName}.`,
        createdOn: "-",
        updatedOn: "-",
        employees_list: employees,
        sub_departments: sub.sub_departments ?? [],
      });
      addSub(deptId, sub.sub_departments ?? [], sub.name, sub.id, id);
    }
  };

  for (const department of departments) {
    rows.push({
      id: department.id,
      apiId: department.apiId,
      name: department.name,
      code: department.code,
      parentApiId: department.parentId,
      parent: department.parent,
      head: department.head,
      title: department.title,
      employees: department.employees,
      status: department.status,
      description: department.description,
      createdOn: department.createdOn,
      updatedOn: department.updatedOn,
      employees_list: department.employees_list,
      sub_departments: department.sub_departments,
    });
    addSub(department.id, department.sub_departments ?? [], department.name, department.apiId);
  }

  return rows;
}

function findNode(nodes: HierarchyNode[], id: string): HierarchyNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function collectSubtreeIds(node: HierarchyNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children ?? []) {
    for (const id of collectSubtreeIds(child)) ids.add(id);
  }
  return ids;
}

function collectAncestorIds(
  nodes: HierarchyNode[],
  id: string,
  trail: string[] = []
): string[] | null {
  for (const node of nodes) {
    const next = [...trail, node.id];
    if (node.id === id) return next;
    if (node.children) {
      const found = collectAncestorIds(node.children, id, next);
      if (found) return found;
    }
  }
  return null;
}

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<DepartmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [treeQuery, setTreeQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [parentFilter, setParentFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hierarchyFilter, setHierarchyFilter] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("Overview");

  // Add/Edit/Delete dialog + inline notice state for the department CRUD
  // actions (hierarchy() GET above stays untouched).
  const [actionNotice, setActionNotice] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  // The create/add-sub-department flow is the multi-step
  // DepartmentCreateWizard (Component/department-create-wizard.tsx) - it
  // owns its own name/code/description/parent form state internally, this
  // page only needs to know whether it's open and which parent (if any) it
  // was launched with.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardParent, setWizardParent] = useState<ListRow | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ListRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ListRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<DepartmentImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [reorderSubmitting, setReorderSubmitting] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeSubmitting, setMergeSubmitting] = useState(false);

  // Assign / change HOD dialog. Originally scoped to the target
  // department's own `employees_list`, but a department can have zero
  // employees of its own (a brand-new one always does) and still needs a
  // head assignable from anyone in the tenant - same reasoning as the
  // creation wizard's Head step, and the same fetch shape (a small default
  // batch immediately, refined by debounced search).
  const [hodTarget, setHodTarget] = useState<ListRow | null>(null);
  const [hodSearch, setHodSearch] = useState("");
  const [hodError, setHodError] = useState<string | null>(null);
  const [hodSubmitting, setHodSubmitting] = useState(false);
  const [hodCandidates, setHodCandidates] = useState<PickerEmployee[]>([]);
  const [hodCandidatesLoading, setHodCandidatesLoading] = useState(false);

  useEffect(() => {
    if (!hodTarget) {
      setHodCandidates([]);
      return;
    }

    const query = hodSearch.trim();
    let cancelled = false;
    setHodCandidatesLoading(true);

    const delay = query ? 300 : 0;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const session = buildSessionContext();
          const data = await getDepartmentEmployees(
            session,
            query ? { search: query, limit: 50 } : { limit: 30 }
          );
          if (cancelled) return;
          setHodCandidates(
            data.map((employee) => ({
              id: employee.id,
              name: employee.name?.trim() || `Employee #${employee.id}`,
              employee_no: employee.employee_no ?? undefined,
              department_name: employee.department_name ?? undefined,
            }))
          );
        } catch (err) {
          if (!cancelled) {
            setHodError(err instanceof Error ? err.message : "Failed to load employees.");
          }
        } finally {
          if (!cancelled) setHodCandidatesLoading(false);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hodTarget, hodSearch]);

  async function fetchDepartments(signal?: AbortSignal, showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const session = getDepartmentSession();
      const url = buildDepartmentsUrl(session);

      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      const response = await fetch(url, {
        signal,
        cache: "no-store",
        headers: {
          ...(session.token
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load departments (status ${response.status})`);
      }

      const data: HierarchyResponse = await response.json();
      const source = resolveDepartments(data);

      const views: DepartmentView[] = source.map((department) => {
        const employees = department.employees ?? [];
        const headInfo = getHeadInfo(employees);
        return {
          id: String(department.id),
          apiId: department.id,
          name: department.name,
          shortName:
            department.name.length > 16
              ? `${department.name.slice(0, 14)}...`
              : department.name,
          code: department.code || `D-${department.id}`,
          parentId: department.parent_id ?? 0,
          sortOrder: department.sort_order ?? 0,
          parent: "-",
          head: headInfo.head,
          title: headInfo.title,
          employees: department.total_employees ?? employees.length,
          status: "Active",
          description:
            department.description ||
            `${department.name} manages its operations, staff, and day-to-day activities.`,
          createdOn: "—",
          updatedOn: "—",
          employees_list: employees,
          sub_departments: department.sub_departments ?? [],
        };
      });

      setDepartments(views);
    } catch (err) {
      if (signal?.aborted) return;
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      if (!signal?.aborted && showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchDepartments(controller.signal, true);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hierarchy = useMemo(() => buildHierarchy(departments), [departments]);
  const listRows = useMemo(() => buildListRows(departments), [departments]);
  const parentOptions = useMemo(
    () =>
      Array.from(new Set(listRows.map((row) => row.parent).filter((parent) => parent !== "-"))),
    [listRows]
  );

  const filteredDepartments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const subtreeIds = hierarchyFilter
      ? (() => {
          const node = findNode(hierarchy, hierarchyFilter);
          return node ? collectSubtreeIds(node) : null;
        })()
      : null;

    const rows = listRows.filter((row) => {
      const matchesSearch =
        !normalizedQuery ||
        row.name.toLowerCase().includes(normalizedQuery) ||
        row.code.toLowerCase().includes(normalizedQuery) ||
        row.parent.toLowerCase().includes(normalizedQuery) ||
        row.head.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "All" || row.status === status;
      const matchesParent =
        parentFilter === "All" ||
        (parentFilter === "Root" ? row.parent === "-" : row.parent === parentFilter);
      const matchesHierarchy = !subtreeIds || subtreeIds.has(row.id);

      return matchesSearch && matchesStatus && matchesParent && matchesHierarchy;
    });

    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      switch (sortKey) {
        case "code":
          av = a.code;
          bv = b.code;
          break;
        case "parent":
          av = a.parent;
          bv = b.parent;
          break;
        case "head":
          av = a.head;
          bv = b.head;
          break;
        case "employees":
          av = a.employees;
          bv = b.employees;
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        default:
          av = a.name;
          bv = b.name;
      }

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

    return rows;
  }, [hierarchy, listRows, query, status, parentFilter, hierarchyFilter, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredDepartments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const selectedRow = selectedId
    ? (listRows.find((row) => row.id === selectedId) ?? null)
    : null;
  const showDetails = Boolean(selectedRow);

  function selectRow(id: string) {
    setSelectedId(id);
  }

  function selectFromHierarchy(id: string) {
    setSelectedId(id);
    setHierarchyFilter(id);
    setPage(1);
    setCollapsedIds((prev) => {
      const trail = collectAncestorIds(hierarchy, id);
      if (!trail) return prev;
      const next = new Set(prev);
      for (const ancestorId of trail.slice(0, -1)) next.delete(ancestorId);
      return next;
    });
  }

  function clearHierarchyFilter() {
    setHierarchyFilter(null);
    setPage(1);
  }

  function handleToggle(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCloseDetails() {
    setSelectedId(null);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((value) => !value);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function openCreateWizard(parent: ListRow | null = null) {
    setWizardParent(parent);
    setWizardOpen(true);
  }

  function closeCreateWizard() {
    setWizardOpen(false);
    setWizardParent(null);
  }

  function openEditDialog(row: ListRow) {
    setEditTarget(row);
    setEditDialogOpen(true);
  }

  function closeEditDialog() {
    setEditDialogOpen(false);
    setEditTarget(null);
  }

  async function handleEditSaved(message: string) {
    setEditDialogOpen(false);
    setEditTarget(null);
    setActionNotice({ type: "success", message });
    await fetchDepartments(undefined, false);
  }

  /**
   * Valid new parents for the row being edited: every department/
   * sub-department except itself and everything beneath it. The backend
   * rejects those moves anyway ("beneath itself or one of its own
   * sub-departments"), so offering them would only produce a guaranteed
   * 422. Reuses the same `hierarchy`/`findNode`/`collectSubtreeIds` helpers
   * already used for the hierarchy tree's own filtering, rather than
   * re-walking `listRows` by hand.
   */
  const editParentOptions = useMemo(() => {
    if (!editTarget) return [];
    const node = findNode(hierarchy, editTarget.id);
    const blocked = node ? collectSubtreeIds(node) : new Set([editTarget.id]);
    return listRows
      .filter((row) => !blocked.has(row.id))
      .map((row) => ({ id: row.apiId, name: row.name, parent: row.parent }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [editTarget, hierarchy, listRows]);

  function openDeleteDialog(row: ListRow) {
    setDeleteTarget(row);
    setDeleteError(null);
    setDeleteImpact(null);
    setMergeMode(false);
    setMergeTargetId("");
    setDeleteDialogOpen(true);

    setDeleteImpactLoading(true);
    (async () => {
      try {
        const session = buildSessionContext();
        const impact = await getDepartmentImpact(session, row.apiId);
        setDeleteImpact(impact);
      } catch {
        // Impact preview is best-effort - deletion can still proceed without it.
      } finally {
        setDeleteImpactLoading(false);
      }
    })();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      await deleteDepartment(session, deleteTarget.apiId);

      setDeleteDialogOpen(false);
      setActionNotice({
        type: "success",
        message:
          deleteTarget.parent !== "-"
            ? "Sub-department removed successfully."
            : "Department removed successfully.",
      });
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
      }
      setDeleteTarget(null);
      await fetchDepartments(undefined, false);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete department."
      );
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function confirmMerge() {
    if (!deleteTarget || !mergeTargetId) return;

    setMergeSubmitting(true);
    setDeleteError(null);

    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      const target = listRows.find((row) => row.id === mergeTargetId);
      if (!target) {
        throw new Error("Select a department to merge into.");
      }

      await mergeDepartments(session, {
        sourceId: deleteTarget.apiId,
        targetId: target.apiId,
      });

      setDeleteDialogOpen(false);
      setActionNotice({
        type: "success",
        message: `${deleteTarget.name} merged into ${target.name} successfully.`,
      });
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
      }
      setDeleteTarget(null);
      await fetchDepartments(undefined, false);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not merge department."
      );
    } finally {
      setMergeSubmitting(false);
    }
  }

  function openHodDialog(row: ListRow) {
    setHodTarget(row);
    setHodSearch("");
    setHodError(null);
  }

  function closeHodDialog() {
    if (hodSubmitting) return;
    setHodTarget(null);
  }

  async function submitSetHead(headUserId: number | null) {
    if (!hodTarget) return;

    setHodSubmitting(true);
    setHodError(null);

    try {
      const session = buildSessionContext();
      if (!session.subInstituteId) {
        throw new Error("Current session is missing sub institute id.");
      }

      await setDepartmentHead(session, hodTarget.apiId, headUserId);

      setHodTarget(null);
      setActionNotice({
        type: "success",
        message:
          headUserId === null
            ? "Department head cleared."
            : "Department head updated successfully.",
      });
      await fetchDepartments(undefined, false);
    } catch (err) {
      setHodError(
        err instanceof Error ? err.message : "Could not update department head."
      );
    } finally {
      setHodSubmitting(false);
    }
  }

  // Move the selected top-level department up/down among its siblings
  // (same parentId), swapping sort_order with the adjacent one. Only
  // top-level departments are reorderable here - sub-departments are a
  // nested list on their parent, not part of `departments`.
  async function moveDepartment(direction: "up" | "down") {
    if (!selectedRow || reorderSubmitting) return;

    const current = departments.find((d) => d.id === selectedRow.id);
    if (!current) return;

    const siblings = departments
      .filter((d) => d.parentId === current.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.apiId - b.apiId);

    const index = siblings.findIndex((d) => d.id === current.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

    const other = siblings[swapIndex];

    setReorderSubmitting(true);
    try {
      const session = buildSessionContext();
      await reorderDepartments(session, [
        { id: current.apiId, sortOrder: other.sortOrder },
        { id: other.apiId, sortOrder: current.sortOrder },
      ]);
      await fetchDepartments(undefined, false);
    } catch (err) {
      setActionNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not reorder departments.",
      });
    } finally {
      setReorderSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex h-[calc(100vh-12px)] min-h-[570px] items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-[12px] font-medium text-muted-foreground">
            Loading departments…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex h-[calc(100vh-12px)] min-h-[570px] items-center justify-center bg-background text-foreground">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-card px-6 py-8 text-center shadow-sm">
          <X className="h-6 w-6 text-destructive" />
          <p className="text-[12px] font-semibold text-foreground">
            Could not load departments
          </p>
          <p className="text-[11px] leading-4 text-muted-foreground">{error}</p>
          <Button
            type="button"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex h-[calc(100vh-12px)] min-h-[640px] flex-col gap-4 overflow-hidden p-4 text-foreground">
        <Breadcrumb />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Department Management
              </h1>
              <Info className="h-4 w-4 text-blue-600" aria-hidden="true" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and organize departments and departmental hierarchy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => openCreateWizard()}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Department
            </Button>
            <Button type="button" variant="outline" size="lg">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </div>
        </div>

        {actionNotice ? (
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px] font-medium",
              actionNotice.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            <span>{actionNotice.message}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              aria-label="Dismiss"
              className="shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-3">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <PanelHeader title="Department Hierarchy" />
            <div className="border-b border-border px-4 pb-4">
              <SearchField value={treeQuery} onChange={setTreeQuery} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {hierarchy.length === 0 ? (
                <p className="px-2 py-4 text-[11px] text-muted-foreground">
                  No departments available.
                </p>
              ) : (
                hierarchy.map((node) => (
                  <HierarchyItem
                    key={node.id}
                    node={node}
                    level={0}
                    collapsedIds={collapsedIds}
                    selectedId={selectedId ?? ""}
                    query={treeQuery}
                    onToggle={handleToggle}
                    onSelect={selectFromHierarchy}
                  />
                ))
              )}
            </div>
            <div className="grid grid-cols-4 border-t border-border p-3">
              <FooterIcon
                label={selectedRow ? "Add sub-department" : "Add department"}
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => openCreateWizard(selectedRow)}
              />
              <FooterIcon
                label="Move up"
                icon={<ChevronDown className="h-3.5 w-3.5 rotate-180" />}
                onClick={() => moveDepartment("up")}
              />
              <FooterIcon
                label="Move down"
                icon={<ChevronDown className="h-3.5 w-3.5" />}
                onClick={() => moveDepartment("down")}
              />
              <FooterIcon
                label="Hierarchy settings"
                icon={<ChevronsUpDown className="h-3.5 w-3.5" />}
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <PanelHeader
              title={`Department List (${filteredDepartments.length})`}
              action={
                hierarchyFilter ? (
                  <button
                    type="button"
                    onClick={clearHierarchyFilter}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-100"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                    Clear filter
                  </button>
                ) : null
              }
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-2 border-b border-border px-4 pb-4">
              <SearchField
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
              />
              <Select
                value={status}
                onValueChange={(value) => {
                  if (!value) return;
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger size="sm" className="h-9 w-[140px] rounded-md text-[12px]">
                  <SelectValue>{status === "All" ? "Status: All" : status}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Status: All</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={parentFilter}
                onValueChange={(value) => {
                  if (!value) return;
                  setParentFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger size="sm" className="h-9 w-[220px] rounded-md text-[12px]">
                  <SelectValue>
                    {parentFilter === "All"
                      ? "Parent Department: All"
                      : parentFilter === "Root"
                        ? "Root Departments"
                        : parentFilter}
                  </SelectValue>
                </SelectTrigger>
                {/* max-h-(--available-height) + overflow-y-auto on SelectContent keeps this
                    list within the viewport with a scrollbar instead of spilling over the
                    page — the plain native <select> this replaced could not be constrained. */}
                <SelectContent>
                  <SelectItem value="All">Parent Department: All</SelectItem>
                  <SelectItem value="Root">Root Departments</SelectItem>
                  {parentOptions.map((parent) => (
                    <SelectItem key={parent} value={parent}>
                      {parent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Refresh"
                onClick={() => fetchDepartments(undefined, false)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <Table className="w-full min-w-[820px]">
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow className="hover:bg-muted">
                    <SortHead label="Department" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-3.5" />
                    <SortHead label="Code" sortKey="code" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-2" />
                    <SortHead label="Parent" sortKey="parent" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-2" />
                    <SortHead label="Head" sortKey="head" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-2" />
                    <SortHead label="Employees" sortKey="employees" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-3 text-center" />
                    <SortHead label="Status" sortKey="status" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="whitespace-nowrap px-3" />
                    <TableHead className="whitespace-nowrap px-2 text-center normal-case">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="h-[120px] text-center text-[11px] text-muted-foreground">
                        No departments match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((department) => {
                      const isSubDepartment = department.parent !== "-";
                      return (
                        <TableRow
                          key={department.id}
                          onClick={() => selectRow(department.id)}
                          className={cn(
                            "cursor-pointer",
                            selectedId === department.id && "bg-blue-50 hover:bg-blue-50"
                          )}
                        >
                          <TableCell className="max-w-[220px] truncate px-3.5 font-semibold text-foreground">
                            {department.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 font-semibold text-foreground">
                            {department.code}
                          </TableCell>
                          <TableCell className="max-w-[140px] px-2 text-muted-foreground">
                            <span className="block truncate">{department.parent}</span>
                          </TableCell>
                          <TableCell className="max-w-[180px] px-2">
                            <Person name={department.head} title={department.title} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3 text-center font-semibold text-foreground">
                            {department.employees}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3">
                            <StatusBadge status={department.status} size="sm" />
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <IconAction label={`View ${department.name}`} icon={<Eye className="h-3.5 w-3.5" />} />
                              <IconAction
                                label={`Edit ${department.name}`}
                                icon={<Pencil className="h-3.5 w-3.5" />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditDialog(department);
                                }}
                              />
                              <IconAction
                                label={`Delete ${department.name}`}
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                className="text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteDialog(department);
                                }}
                              />
                              <div onClick={(event) => event.stopPropagation()}>
                                <RowMenu
                                  isSubDepartment={isSubDepartment}
                                  onEdit={() => openEditDialog(department)}
                                  onAddSubDepartment={() => openCreateWizard(department)}
                                  onAssignHod={() => openHodDialog(department)}
                                  onDelete={() => openDeleteDialog(department)}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex min-h-[51px] flex-col flex-wrap items-start justify-between gap-2 border-t border-border px-3.5 py-2.5 sm:flex-row sm:items-center">
              <p className="text-[11px] text-muted-foreground">
                Showing {filteredDepartments.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filteredDepartments.length)} of{" "}
                {filteredDepartments.length} entries
              </p>
              <div className="flex max-w-full items-center gap-1.5 overflow-x-auto">
                <PaginationButton
                  label="Previous page"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </PaginationButton>
                {getPaginationItems(currentPage, totalPages).map((item, index) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center text-[12px] text-muted-foreground"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      aria-current={currentPage === item ? "page" : undefined}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[12px] font-semibold transition-colors",
                        currentPage === item
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      {item}
                    </button>
                  )
                )}
                <PaginationButton
                  label="Next page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </PaginationButton>
              </div>
            </div>
          </section>
        </div>

        {/*
         * Department Details is a right-side slide-over, not a third grid
         * column - it overlays instead of squeezing the hierarchy/list
         * panels, matching the Sheet convention already used for the
         * Employee Directory's detail panel (see
         * employee-directory-sheets.tsx). Content below is unchanged from
         * the previous inline <aside>.
         */}
        {/* modal={false}: this Sheet's Employees/Job Roles tabs nest base-ui
            <Select>s whose popups portal outside Radix's modal focus-trap
            boundary - same fix as department-create-wizard.tsx and
            department-edit-dialog.tsx, for the same reason (the trap fights
            the popup and it never stays open). */}
        <Sheet
          open={showDetails}
          modal={false}
          onOpenChange={(open) => { if (!open) handleCloseDetails(); }}
        >
          {selectedRow ? (
            <SheetContent
              side="right"
              className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-border bg-card p-0 sm:max-w-xl"
            >
              {/* SheetContent already renders its own close button
                  (top-right) - a second one here duplicated it. */}
              <div className="flex h-[50px] items-center border-b border-border px-3.5">
                <h2 className="text-[13px] font-semibold text-foreground">
                  Department Details
                </h2>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Folder className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-[13px] font-semibold text-foreground">
                      {selectedRow.name}
                    </h3>
                    <StatusBadge status={selectedRow.status} size="sm" />
                  </div>
                  <p className="mt-2 truncate text-[11px] text-muted-foreground">
                    {selectedRow.code} <span className="px-1">-</span> {selectedRow.parent}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border px-3.5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(selectedRow)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit {selectedRow.parent !== "-" ? "sub department" : "department"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openCreateWizard(selectedRow)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add sub department
                </Button>
              </div>
              <div className="border-t border-border px-3.5 py-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => openDeleteDialog(selectedRow)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove {selectedRow.parent !== "-" ? "sub department" : "department"}
                </Button>
              </div>

              <div className="grid h-9 grid-cols-6 border-y border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "border-b-2 text-[11px] font-medium",
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-muted-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-5">
                {activeTab === "Employees" ? (
                  <DepartmentEmployeesPanel
                    department={{ id: selectedRow.apiId, name: selectedRow.name }}
                    departments={listRows.map((row) => ({ id: row.apiId, name: row.name }))}
                    canManage
                    onChanged={() => void fetchDepartments(undefined, false)}
                  />
                ) : activeTab === "Job Roles" ? (
                  <DepartmentJobRolesPanel
                    department={{ id: selectedRow.apiId, name: selectedRow.name }}
                    canManage
                  />
                ) : activeTab === "SOPs" ? (
                  <SopsModule departmentName={selectedRow.name} departmentId={selectedRow.apiId} />
                ) : activeTab === "Policies" ? (
                  <PoliciesModule departmentName={selectedRow.name} />
                ) : activeTab === "Rules" ? (
                  <RulesModule departmentName={selectedRow.name} />
                ) : activeTab === "Overview" ? (
                  <>
                    <div className="pt-1">
                      <DetailLine
                        icon={<UserRound className="h-3.5 w-3.5" />}
                        label="Department Head"
                        value={selectedRow.head === "-" ? "Unassigned" : selectedRow.head}
                        action={selectedRow.head === "-" ? "Assign HOD" : "Change HOD"}
                        onAction={() => openHodDialog(selectedRow)}
                      />
                      <DetailLine
                        icon={<Folder className="h-3.5 w-3.5" />}
                        label="Parent Department"
                        value={selectedRow.parent}
                      />
                      <DetailLine
                        icon={<Users className="h-3.5 w-3.5" />}
                        label="Total Employees"
                        value={String(selectedRow.employees)}
                      />
                      <DetailLine
                        icon={<CalendarDays className="h-3.5 w-3.5" />}
                        label="Created On"
                        value={selectedRow.createdOn}
                      />
                      <DetailLine
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                        label="Last Updated"
                        value={selectedRow.updatedOn}
                      />
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <h4 className="mb-2 text-[12px] font-semibold text-foreground">
                        Description
                      </h4>
                      <p className="text-[11px] leading-[19px] text-muted-foreground">
                        {selectedRow.description}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <h4 className="mb-2 text-[12px] font-semibold text-foreground">
                        Employees ({selectedRow.employees_list.length})
                      </h4>
                      {selectedRow.employees_list.length === 0 ? (
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          No employees assigned to this department.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {selectedRow.employees_list.map((employee) => (
                            <li
                              key={employee.id}
                              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                                {initials(employee.name)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11px] font-semibold text-foreground">
                                  {employee.name}
                                </span>
                                <span className="block truncate text-[10px] text-muted-foreground">
                                  Emp No: {employee.employee_no}
                                  {employee.gender ? ` • ${employee.gender}` : ""}
                                </span>
                              </span>
                              {employee.mobile && employee.mobile !== "-" ? (
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {employee.mobile}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[12px] font-semibold text-foreground">
                          Sub Departments ({selectedRow.sub_departments.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => openCreateWizard(selectedRow)}
                          className="text-[10px] font-medium text-blue-600"
                        >
                          Add sub-department
                        </button>
                      </div>
                      {selectedRow.sub_departments.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {selectedRow.sub_departments.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
                            >
                              <Folder className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">
                                {sub.name}
                              </span>
                              <Badge variant="secondary" className="rounded-full px-2">
                                {sub.total_employees} emp
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          No sub-departments yet.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="border-t border-border pt-4">
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      No {activeTab.toLowerCase()} records configured for this
                      department.
                    </p>
                  </div>
                )}
              </div>
            </SheetContent>
          ) : null}
        </Sheet>
      </main>

      <DepartmentCreateWizard
        open={wizardOpen}
        parentOptions={listRows.map((row) => ({ id: row.apiId, name: row.name }))}
        initialParent={wizardParent ? { id: wizardParent.apiId, name: wizardParent.name } : null}
        onCancel={closeCreateWizard}
        onCreated={() => fetchDepartments(undefined, false)}
        onFinished={() => {
          closeCreateWizard();
          setActionNotice({
            type: "success",
            message: wizardParent
              ? "Sub-department added successfully."
              : "Department added successfully.",
          });
          void fetchDepartments(undefined, false);
        }}
      />

      <DepartmentEditDialog
        open={editDialogOpen}
        target={editTarget}
        parentOptions={editParentOptions}
        onCancel={closeEditDialog}
        onSaved={(message) => void handleEditSaved(message)}
      />

      <Dialog open={Boolean(hodTarget)} onOpenChange={(open) => { if (!open) closeHodDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {hodTarget && hodTarget.head !== "-" ? "Change head of department" : "Assign head of department"}
            </DialogTitle>
            <DialogDescription>
              {hodTarget ? `Select the employee who leads "${hodTarget.name}".` : ""}
            </DialogDescription>
          </DialogHeader>

          <HeadOfDepartmentPicker
            currentHead={hodTarget?.head ?? "-"}
            employees={hodCandidates}
            loading={hodCandidatesLoading}
            emptyHint={hodSearch.trim() ? "No employees match that search." : "No employees available to assign."}
            search={hodSearch}
            onSearchChange={setHodSearch}
            isSubmitting={hodSubmitting}
            onAssign={(employeeId) => submitSetHead(employeeId)}
            onClear={() => submitSetHead(null)}
            error={hodError}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeHodDialog} disabled={hodSubmitting}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {deleteTarget && deleteTarget.parent !== "-" ? "sub-department" : "department"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.parent !== "-"
                ? `Remove ${deleteTarget.name}? This action cannot be undone.`
                : `Remove ${deleteTarget?.name ?? "this department"} and its sub-departments? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteImpactLoading ? (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking what this affects…
            </p>
          ) : deleteImpact && deleteImpact.total_records > 0 ? (
            <div className="space-y-2">
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                Deleting this affects {deleteImpact.total_records} record
                {deleteImpact.total_records === 1 ? "" : "s"}
                {deleteImpact.sub_departments > 0
                  ? ` across ${deleteImpact.sub_departments} sub-department${deleteImpact.sub_departments === 1 ? "" : "s"} and related tables.`
                  : " in related tables."}
              </p>
              {!mergeMode ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-blue-600 underline-offset-2 hover:underline"
                  onClick={() => setMergeMode(true)}
                >
                  Merge into another department instead, so those records stay attached
                </button>
              ) : null}
            </div>
          ) : null}
          {mergeMode && deleteTarget ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-foreground">Merge into</p>
              <Select value={mergeTargetId} onValueChange={(value) => setMergeTargetId(value ?? "")}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {listRows
                    .filter(
                      (row) =>
                        row.id !== deleteTarget.id &&
                        !row.id.startsWith(`${deleteTarget.id}-s-`)
                    )
                    .map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.parent !== "-" ? `${row.parent} / ${row.name}` : row.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setMergeMode(false);
                  setMergeTargetId("");
                }}
              >
                Cancel merge, delete instead
              </button>
            </div>
          ) : null}
          {deleteError ? (
            <p className="text-[11px] font-medium text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            {mergeMode ? (
              <Button
                type="button"
                disabled={mergeSubmitting || !mergeTargetId}
                onClick={confirmMerge}
              >
                {mergeSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Merge
              </Button>
            ) : (
              <Button type="button" variant="destructive" disabled={deleteSubmitting} onClick={confirmDelete}>
                {deleteSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Remove
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
