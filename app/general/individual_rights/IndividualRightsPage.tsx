"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, LoaderCircle, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  loadIndividualRightsDashboard,
  loadIndividualRightsMatrix,
  loadIndividualRightsUsers,
  saveIndividualRights,
  type IndividualRightsMatrixRow,
  type IndividualRightsMatrixState,
  type IndividualRightsPermissionSet,
  type IndividualRightsProfile,
  type IndividualRightsSummaryRecord,
  type IndividualRightsUser,
} from "./api";

type RightKey = "view" | "add" | "edit" | "delete";

const noMatrix: IndividualRightsMatrixState = {
  rows: [],
  selected: {},
};

const rightLabels: Array<{ key: RightKey; label: string }> = [
  { key: "view", label: "Can View" },
  { key: "add", label: "Can Add" },
  { key: "edit", label: "Can Edit" },
  { key: "delete", label: "Can Delete" },
];

function rightIcon(value: boolean) {
  return value ? "Yes" : "No";
}

function rowStyle(row: IndividualRightsMatrixRow): string {
  if (row.level === 1) return "bg-sky-50 font-semibold text-slate-900";
  if (row.level === 2 && row.menuType === "MASTER") return "text-emerald-700";
  if (row.level === 2) return "font-medium text-blue-700";
  return "text-slate-700";
}

function rowLabel(row: IndividualRightsMatrixRow): string {
  if (row.level === 2 && row.menuType !== "MASTER") return `>> ${row.name}`;
  if (row.level === 3) return `    ${row.name}`;
  return row.name;
}

export function IndividualRightsPage() {
  const [profiles, setProfiles] = useState<IndividualRightsProfile[]>([]);
  const [users, setUsers] = useState<IndividualRightsUser[]>([]);
  const [summary, setSummary] = useState<IndividualRightsSummaryRecord[]>([]);
  const [permissions, setPermissions] = useState<IndividualRightsPermissionSet>({
    view: false,
    add: false,
    edit: false,
    delete: false,
    admin: false,
  });
  const [selectedProfileId, setSelectedProfileId] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState(0);
  const [matrix, setMatrix] = useState<IndividualRightsMatrixState>(noMatrix);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadIndividualRightsDashboard();
      setProfiles(data.profiles.filter((profile) => profile.status === 1));
      setSummary(data.summary);
      setPermissions(data.permissions);
    } catch (value: unknown) {
      setError(errorMessage(value, "Individual rights could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (profileId: number) => {
    if (!profileId) {
      setUsers([]);
      setMatrix(noMatrix);
      return;
    }

    setUsersLoading(true);
    setError("");
    try {
      const data = await loadIndividualRightsUsers(profileId);
      setUsers(data.users);
      setMatrix({
        rows: data.rows,
        selected: {},
      });
    } catch (value: unknown) {
      setError(errorMessage(value, "The profile users and rights matrix could not be loaded."));
      setUsers([]);
      setMatrix(noMatrix);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadMatrix = useCallback(async (profileId: number, userId: number) => {
    if (!profileId || !userId) {
      setMatrix((current) => ({
        rows: current.rows,
        selected: {},
      }));
      return;
    }

    setMatrixLoading(true);
    setError("");
    try {
      setMatrix(await loadIndividualRightsMatrix(profileId, userId));
    } catch (value: unknown) {
      setError(errorMessage(value, "The selected user's rights could not be loaded."));
      setMatrix((current) => ({
        rows: current.rows,
        selected: {},
      }));
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
    setSelectedUserId(0);
    setUsers([]);
    setMatrix(noMatrix);
    await loadUsers(profileId);
  }

  async function onUserChange(userId: number) {
    setSelectedUserId(userId);
    await loadMatrix(selectedProfileId, userId);
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

    if (!selectedUserId) {
      setError("User is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      setNotice(await saveIndividualRights(selectedProfileId, selectedUserId, matrix.selected));
      const latest = await loadIndividualRightsDashboard();
      setProfiles(latest.profiles.filter((profile) => profile.status === 1));
      setSummary(latest.summary);
      setPermissions(latest.permissions);
      await loadUsers(selectedProfileId);
      await loadMatrix(selectedProfileId, selectedUserId);
    } catch (value: unknown) {
      setError(errorMessage(value, "Individual rights could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const summaryColumns: Array<RecordColumn<IndividualRightsSummaryRecord>> = useMemo(
    () => [
      { key: "profile_name", label: "User Profile Name", value: (row) => row.profileName },
      { key: "user_name", label: "User Name", value: (row) => row.userName },
      { key: "menu_name", label: "Menu Name", value: (row) => row.menuName },
      { key: "can_view", label: "Can View", value: (row) => rightIcon(row.canView) },
      { key: "can_add", label: "Can Add", value: (row) => rightIcon(row.canAdd) },
      { key: "can_edit", label: "Can Edit", value: (row) => rightIcon(row.canEdit) },
      { key: "can_delete", label: "Can Delete", value: (row) => rightIcon(row.canDelete) },
    ],
    []
  );

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Individual Rights"
        description="Assign view, add, edit, and delete rights to individual users using the legacy ERP menu tree."
        onRefresh={() => void load()}
        refreshing={loading || usersLoading || matrixLoading || saving}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <ErpSection
        title="Manage Rights"
        description="Choose a user profile, then a user, and update the user's menu rights."
        icon={<UserRound className="size-5" />}
        footer={
          <Button
            onClick={() => void save()}
            disabled={saving || usersLoading || matrixLoading || !selectedProfileId || !selectedUserId || !permissions.add}
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Rights
          </Button>
        }
      >
        {loading ? (
          <ErpLoading label="Loading profiles and saved rights..." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="profile_id" className="text-sm font-medium text-slate-700">
                  User Profile *
                </label>
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

              <div className="space-y-2">
                <label htmlFor="user_id" className="text-sm font-medium text-slate-700">
                  User *
                </label>
                <select
                  id="user_id"
                  className={erpSelectClass}
                  value={selectedUserId}
                  disabled={selectedProfileId === 0 || usersLoading || users.length === 0}
                  onChange={(event) => void onUserChange(Number(event.target.value))}
                >
                  <option value={0}>Select User</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.userName}
                    </option>
                  ))}
                </select>
              </div>
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
              <ErpEmpty title="Select a user profile to load users and the rights matrix." />
            ) : usersLoading ? (
              <ErpLoading label="Loading profile users and menu rights..." />
            ) : matrix.rows.length === 0 ? (
              <ErpEmpty
                title="No profile-wise menus were returned for this profile."
                hint="The old module only lists menus that already exist in tblprofilewise_menu for the selected profile."
              />
            ) : (
              <div className="space-y-3">
                {users.length === 0 ? (
                  <ErpEmpty
                    title="No active users were returned for this profile."
                    hint="The old module only lists active users mapped to the selected profile."
                  />
                ) : selectedUserId === 0 ? (
                  <ErpAlert tone="info">Select a user to load their saved individual rights.</ErpAlert>
                ) : null}

                {matrixLoading ? (
                  <ErpLoading label="Loading selected user rights..." />
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
                                  disabled={saving || !permissions.add || selectedUserId === 0}
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
                          };

                          return (
                            <TableRow key={row.menuId} className={rowStyle(row)}>
                              <TableCell className="whitespace-normal">{rowLabel(row)}</TableCell>
                              {rightLabels.map((right) => (
                                <TableCell key={`${row.menuId}-${right.key}`} className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={selected[right.key]}
                                    disabled={saving || !permissions.add || selectedUserId === 0}
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
          </div>
        )}
      </ErpSection>

      <ErpSection
        title="Rights Summary"
        description="Current individual rights already stored in Laravel."
        icon={<KeyRound className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading individual rights summary..." />
        ) : (
          <RecordTable
            rows={summary}
            columns={summaryColumns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search by profile, user, or menu"
            exportFilename="individual-rights"
            exportTitle="Individual Rights"
            emptyTitle="No individual rights found."
            emptyHint="Save at least one rights combination to see it here."
          />
        )}
      </ErpSection>
    </main>
  );
}
