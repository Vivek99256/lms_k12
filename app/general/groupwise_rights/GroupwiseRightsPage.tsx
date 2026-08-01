"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, LoaderCircle, Save } from "lucide-react";
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
  ErpAlert,
  ErpEmpty,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
  erpSelectClass,
} from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import {
  loadGroupwiseDashboard,
  loadGroupwiseMatrix,
  saveGroupwiseRights,
  type GroupwiseMatrixRow,
  type GroupwiseMatrixState,
  type GroupwisePermissionSet,
  type GroupwiseProfile,
  type GroupwiseSummaryRecord,
} from "./api";

type RightKey = "view" | "add" | "edit" | "delete" | "dashboardRight";

const noMatrix: GroupwiseMatrixState = {
  rows: [],
  selected: {},
};

const rightLabels: Array<{ key: RightKey; label: string }> = [
  { key: "view", label: "Can View" },
  { key: "add", label: "Can Add" },
  { key: "edit", label: "Can Edit" },
  { key: "delete", label: "Can Delete" },
  { key: "dashboardRight", label: "Dashboard Right" },
];

function rightIcon(value: boolean) {
  return value ? "Yes" : "No";
}

function rowStyle(row: GroupwiseMatrixRow): string {
  if (row.level === 1) return "bg-sky-50 font-semibold text-slate-900";
  if (row.level === 2 && row.menuType === "MASTER") return "text-emerald-700";
  if (row.level === 2) return "font-medium text-blue-700";
  return "text-slate-700";
}

function rowLabel(row: GroupwiseMatrixRow): string {
  if (row.level === 2 && row.menuType !== "MASTER") return `>> ${row.name}`;
  if (row.level === 3) return `    ${row.name}`;
  return row.name;
}

export function GroupwiseRightsPage() {
  const [profiles, setProfiles] = useState<GroupwiseProfile[]>([]);
  const [summary, setSummary] = useState<GroupwiseSummaryRecord[]>([]);
  const [permissions, setPermissions] = useState<GroupwisePermissionSet>({
    view: false,
    add: false,
    edit: false,
    delete: false,
    admin: false,
  });
  const [selectedProfileId, setSelectedProfileId] = useState<number>(0);
  const [matrix, setMatrix] = useState<GroupwiseMatrixState>(noMatrix);
  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadGroupwiseDashboard();
      setProfiles(data.profiles.filter((profile) => profile.status === 1));
      setSummary(data.summary);
      setPermissions(data.permissions);
    } catch (value: unknown) {
      setError(errorMessage(value, "Group-wise rights could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMatrix = useCallback(async (profileId: number) => {
    if (!profileId) {
      setMatrix(noMatrix);
      return;
    }

    setMatrixLoading(true);
    setError("");
    try {
      setMatrix(await loadGroupwiseMatrix(profileId));
    } catch (value: unknown) {
      setError(errorMessage(value, "The rights matrix could not be loaded."));
      setMatrix(noMatrix);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage holds the ERP session, so module bootstrap runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function onProfileChange(profileId: number) {
    setSelectedProfileId(profileId);
    await loadMatrix(profileId);
  }

  function toggleRight(menuId: number, key: RightKey, checked: boolean) {
    setMatrix((current) => ({
      ...current,
      selected: {
        ...current.selected,
        [menuId]: {
          view: current.selected[menuId]?.view ?? false,
          add: current.selected[menuId]?.add ?? false,
          edit: current.selected[menuId]?.edit ?? false,
          delete: current.selected[menuId]?.delete ?? false,
          dashboardRight: current.selected[menuId]?.dashboardRight ?? false,
          [key]: checked,
        },
      },
    }));
  }

  function toggleAll(key: RightKey, checked: boolean) {
    setMatrix((current) => ({
      ...current,
      selected: Object.fromEntries(
        current.rows.map((row) => [
          row.menuId,
          {
            view: key === "view" ? checked : current.selected[row.menuId]?.view ?? false,
            add: key === "add" ? checked : current.selected[row.menuId]?.add ?? false,
            edit: key === "edit" ? checked : current.selected[row.menuId]?.edit ?? false,
            delete: key === "delete" ? checked : current.selected[row.menuId]?.delete ?? false,
            dashboardRight: current.selected[row.menuId]?.dashboardRight ?? false,
          },
        ])
      ),
    }));
  }

  async function save() {
    if (!selectedProfileId) {
      setError("User profile is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      setNotice(await saveGroupwiseRights(selectedProfileId, matrix.selected));
      const latest = await loadGroupwiseDashboard();
      setProfiles(latest.profiles.filter((profile) => profile.status === 1));
      setSummary(latest.summary);
      setPermissions(latest.permissions);
      await loadMatrix(selectedProfileId);
    } catch (value: unknown) {
      setError(errorMessage(value, "Group-wise rights could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const filteredSummary = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return summary;
    return summary.filter((row) =>
      [row.profileName, row.menuName].some((value) => value.toLowerCase().includes(query))
    );
  }, [search, summary]);

  const summaryColumns: Array<RecordColumn<GroupwiseSummaryRecord>> = [
    { key: "profile_name", label: "User Profile Name", value: (row) => row.profileName },
    { key: "menu_name", label: "Menu Name", value: (row) => row.menuName },
    { key: "can_view", label: "Can View", value: (row) => rightIcon(row.canView) },
    { key: "can_add", label: "Can Add", value: (row) => rightIcon(row.canAdd) },
    { key: "can_edit", label: "Can Edit", value: (row) => rightIcon(row.canEdit) },
    { key: "can_delete", label: "Can Delete", value: (row) => rightIcon(row.canDelete) },
    { key: "dashboard_right", label: "Dashboard Right", value: (row) => rightIcon(row.dashboardRight) },
  ];

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Group-wise Rights"
        description="Assign view, add, edit, and delete rights to user profiles using the legacy ERP menu tree."
        onRefresh={() => void load()}
        refreshing={loading || matrixLoading || saving}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <ErpSection
        title="Manage Rights"
        description="Choose a user profile, then update the menu rights matrix."
        icon={<KeyRound className="size-5" />}
        footer={
          <Button onClick={() => void save()} disabled={saving || matrixLoading || !selectedProfileId || !permissions.add}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Rights
          </Button>
        }
      >
        {loading ? (
          <ErpLoading label="Loading profiles and rights..." />
        ) : (
          <div className="space-y-4">
            <div className="max-w-md space-y-2">
              <Label htmlFor="profile_id">User Profile *</Label>
              <select
                id="profile_id"
                className={erpSelectClass}
                value={selectedProfileId}
                onChange={(event) => void onProfileChange(Number(event.target.value))}
              >
                <option value={0}>Select User Profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

            {!permissions.view ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>You do not have permission to view this module.</div>
                </div>
              </div>
            ) : null}

            {selectedProfileId === 0 ? (
              <ErpEmpty title="Select a user profile to load the rights matrix." />
            ) : matrixLoading ? (
              <ErpLoading label="Loading rights matrix..." />
            ) : matrix.rows.length === 0 ? (
              <ErpEmpty title="No profile-wise menus were returned for this profile." hint="The old module only lists menus that already exist in tblprofilewise_menu for the selected profile." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[260px]">Menu Name</TableHead>
                      {rightLabels.map((right) => (
                        <TableHead key={right.key} className="text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span>{right.label}</span>
                            <input
                              type="checkbox"
                              aria-label={`Select all ${right.label}`}
                              disabled={saving || !permissions.add}
                              onChange={(event) => toggleAll(right.key, event.target.checked)}
                            />
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrix.rows.map((row) => {
                      const selected = matrix.selected[row.menuId] ?? {
                        view: false,
                        add: false,
                        edit: false,
                        delete: false,
                        dashboardRight: false,
                      };

                      return (
                        <TableRow key={row.menuId} className={rowStyle(row)}>
                          <TableCell className="whitespace-normal">{rowLabel(row)}</TableCell>
                          {rightLabels.map((right) => (
                            <TableCell key={`${row.menuId}-${right.key}`} className="text-center">
                              <input
                                type="checkbox"
                                checked={selected[right.key]}
                                disabled={saving || !permissions.add}
                                aria-label={`${right.label} for ${row.name}`}
                                onChange={(event) => toggleRight(row.menuId, right.key, event.target.checked)}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </ErpSection>

      <ErpSection
        title="Rights Summary"
        description="Current rights records already stored in Laravel."
        icon={<KeyRound className="size-5" />}
      >
        <div className="mb-4 max-w-sm">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by profile or menu"
          />
        </div>
        {loading ? (
          <ErpLoading label="Loading rights summary..." />
        ) : (
          <RecordTable
            rows={filteredSummary}
            columns={summaryColumns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search rights..."
            exportFilename="groupwise-rights"
            exportTitle="Group-wise Rights"
            emptyTitle="No group-wise rights found."
            emptyHint="Save at least one rights combination to see it here."
          />
        )}
      </ErpSection>
    </main>
  );
}
