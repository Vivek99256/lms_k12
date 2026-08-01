"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImageIcon, LoaderCircle, Pencil, Save, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Modal } from "@/components/result/primitives";
import {
  loadMobileAppRightsBootstrap,
  loadMobileConfig,
  loadMobileRights,
  saveMobileRights,
  updateMobileConfig,
  type MobileAppRightsPermissionSet,
  type MobileAppRightsProfile,
  type MobileConfigProfile,
  type MobileConfigRecord,
  type MobileConfigUpdateInput,
  type MobileRightsRow,
} from "./api";

const sortOptions = Array.from({ length: 12 }, (_, index) => index + 1);

function previewImage(url: string, alt: string) {
  if (!url) return <span className="text-slate-400">No image</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="h-12 w-16 rounded-md border border-slate-200 object-cover" />;
}

function emptyConfigInput(profileName: MobileConfigProfile): MobileConfigUpdateInput {
  return {
    profileName,
    mainTitle: "",
    mainTitleColorCode: "#000000",
    mainTitleBackgroundImage: "",
    mainSortOrder: 1,
    subTitleOfMain: "",
    subTitleIcon: "",
    subTitleSortOrder: 1,
    status: "Yes",
  };
}

export function MobileAppRightsPage() {
  const [profiles, setProfiles] = useState<MobileAppRightsProfile[]>([]);
  const [configProfiles, setConfigProfiles] = useState<MobileConfigProfile[]>(["Admin", "Teacher", "Student"]);
  const [permissions, setPermissions] = useState<MobileAppRightsPermissionSet>({
    view: false,
    add: false,
    edit: false,
    delete: false,
    admin: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedRightsProfileId, setSelectedRightsProfileId] = useState(0);
  const [rightsRows, setRightsRows] = useState<MobileRightsRow[]>([]);
  const [selectedRights, setSelectedRights] = useState<Record<string, boolean>>({});
  const [rightsLoading, setRightsLoading] = useState(false);
  const [rightsSaving, setRightsSaving] = useState(false);

  const [configProfile, setConfigProfile] = useState<MobileConfigProfile>("Student");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [configRows, setConfigRows] = useState<MobileConfigRecord[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSearched, setConfigSearched] = useState(false);
  const [editing, setEditing] = useState<MobileConfigRecord | null>(null);
  const [editInput, setEditInput] = useState<MobileConfigUpdateInput>(emptyConfigInput("Student"));
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadMobileAppRightsBootstrap();
      setProfiles(data.profiles.filter((profile) => profile.status === 1));
      setConfigProfiles(data.configProfiles);
      setPermissions(data.permissions);
      if (data.configProfiles.length > 0) {
        setConfigProfile(data.configProfiles[0]);
        setEditInput(emptyConfigInput(data.configProfiles[0]));
      }
    } catch (value: unknown) {
      setError(errorMessage(value, "Mobile App Menu Rights could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Browser storage holds the ERP session, so module bootstrap runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const loadRights = useCallback(async (profileId: number) => {
    if (!profileId) {
      setRightsRows([]);
      setSelectedRights({});
      return;
    }

    setRightsLoading(true);
    setError("");
    try {
      const data = await loadMobileRights(profileId);
      setRightsRows(data.rows);
      setSelectedRights(
        Object.fromEntries(data.selected.map((screenName) => [screenName, true]))
      );
    } catch (value: unknown) {
      setError(errorMessage(value, "The mobile app rights matrix could not be loaded."));
      setRightsRows([]);
      setSelectedRights({});
    } finally {
      setRightsLoading(false);
    }
  }, []);

  async function searchConfig() {
    setConfigLoading(true);
    setConfigSearched(true);
    setError("");
    try {
      setConfigRows(await loadMobileConfig(configProfile, includeInactive));
    } catch (value: unknown) {
      setError(errorMessage(value, "The mobile app menu configuration could not be loaded."));
      setConfigRows([]);
    } finally {
      setConfigLoading(false);
    }
  }

  function toggleRight(screenName: string, checked: boolean) {
    setSelectedRights((current) => ({
      ...current,
      [screenName]: checked,
    }));
  }

  function toggleAllRights(checked: boolean) {
    setSelectedRights(
      Object.fromEntries(rightsRows.map((row) => [row.screenName, checked]))
    );
  }

  async function saveRights() {
    if (!selectedRightsProfileId) {
      setError("User profile is required.");
      return;
    }

    setRightsSaving(true);
    setError("");
    setNotice("");
    try {
      setNotice(await saveMobileRights(selectedRightsProfileId, selectedRights));
      await loadRights(selectedRightsProfileId);
    } catch (value: unknown) {
      setError(errorMessage(value, "Mobile app rights could not be saved."));
    } finally {
      setRightsSaving(false);
    }
  }

  function openEdit(record: MobileConfigRecord) {
    setEditing(record);
    setEditInput({
      profileName: configProfile,
      mainTitle: record.mainTitle,
      mainTitleColorCode: record.mainTitleColorCode || "#000000",
      mainTitleBackgroundImage: record.mainTitleBackgroundImage,
      mainSortOrder: record.mainSortOrder || 1,
      subTitleOfMain: record.subTitleOfMain,
      subTitleIcon: record.subTitleIcon,
      subTitleSortOrder: record.subTitleSortOrder || 1,
      status: record.status === "No" ? "No" : "Yes",
    });
  }

  async function saveConfig() {
    if (!editing) return;

    setEditSaving(true);
    setError("");
    setNotice("");
    try {
      setNotice(await updateMobileConfig(editing.id, editInput));
      setEditing(null);
      await searchConfig();
    } catch (value: unknown) {
      setError(errorMessage(value, "The mobile app menu record could not be updated."));
    } finally {
      setEditSaving(false);
    }
  }

  const configColumns: Array<RecordColumn<MobileConfigRecord>> = useMemo(
    () => [
      { key: "main_title", label: "Main Title", value: (row) => row.mainTitle },
      {
        key: "main_title_color_code",
        label: "Color Code",
        value: (row) => row.mainTitleColorCode,
      },
      {
        key: "main_title_background_image",
        label: "Background",
        value: (row) => row.mainTitleBackgroundImage,
        render: (row) => previewImage(row.mainTitleBackgroundImage, row.mainTitle),
        sortable: false,
      },
      {
        key: "main_sort_order",
        label: "Main Sort Order",
        value: (row) => String(row.mainSortOrder),
      },
      {
        key: "sub_title_of_main",
        label: "Sub Title of Main",
        value: (row) => row.subTitleOfMain,
      },
      {
        key: "sub_title_icon",
        label: "Sub Title Icon",
        value: (row) => row.subTitleIcon,
        render: (row) => previewImage(row.subTitleIcon, row.subTitleOfMain),
        sortable: false,
      },
      {
        key: "sub_title_sort_order",
        label: "Sub Title Sort Order",
        value: (row) => String(row.subTitleSortOrder),
      },
      {
        key: "status",
        label: "Status",
        value: (row) => row.status,
      },
      {
        key: "screen_name",
        label: "Screen Name",
        value: (row) => row.screenName,
      },
    ],
    []
  );

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Mobile App Menu Rights"
        description="Configure mobile app home screen rights and visibility per profile using the legacy ERP rules."
        onRefresh={() => void load()}
        refreshing={loading || rightsLoading || rightsSaving || configLoading || editSaving}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <ErpSection
        title="Assign Mobile App Rights"
        description="Choose a user profile and enable the mobile app screens that should be available for that profile."
        icon={<Smartphone className="size-5" />}
        footer={
          <Button
            onClick={() => void saveRights()}
            disabled={rightsSaving || rightsLoading || !selectedRightsProfileId || !permissions.add}
          >
            {rightsSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Rights
          </Button>
        }
      >
        {loading ? (
          <ErpLoading label="Loading mobile app rights..." />
        ) : (
          <div className="space-y-4">
            <div className="max-w-md space-y-2">
              <Label htmlFor="rights_profile_id">User Profile *</Label>
              <select
                id="rights_profile_id"
                className={erpSelectClass}
                value={selectedRightsProfileId}
                onChange={(event) => {
                  const profileId = Number(event.target.value);
                  setSelectedRightsProfileId(profileId);
                  void loadRights(profileId);
                }}
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

            {selectedRightsProfileId === 0 ? (
              <ErpEmpty title="Select a user profile to load mobile app rights." />
            ) : rightsLoading ? (
              <ErpLoading label="Loading mobile app rights matrix..." />
            ) : rightsRows.length === 0 ? (
              <ErpEmpty
                title="No mobile app rights template was returned for this profile."
                hint="The legacy module only supports Student, Admin, and Teacher profiles with default rows stored under sub_institute_id = 1."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">User Profile Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Main Title</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Sub Title of Main</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Screen Name</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">
                        <div className="flex flex-col items-center gap-2">
                          <span>Rights</span>
                          <input
                            type="checkbox"
                            aria-label="Select all mobile app rights"
                            disabled={rightsSaving || !permissions.add}
                            onChange={(event) => toggleAllRights(event.target.checked)}
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rightsRows.map((row) => (
                      <tr key={row.screenName}>
                        <td className="px-4 py-3">{row.userProfileName || "-"}</td>
                        <td className="px-4 py-3">{row.mainTitle || "-"}</td>
                        <td className="px-4 py-3">{row.subTitleOfMain || "-"}</td>
                        <td className="px-4 py-3">{row.screenName || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedRights[row.screenName])}
                            disabled={rightsSaving || !permissions.add}
                            aria-label={`Rights for ${row.screenName}`}
                            onChange={(event) => toggleRight(row.screenName, event.target.checked)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </ErpSection>

      <ErpSection
        title="Mobile App Menu Configuration"
        description="Search the saved mobile app menu records by profile and update the menu metadata using the same Laravel behavior."
        icon={<ImageIcon className="size-5" />}
      >
        {loading ? (
          <ErpLoading label="Loading configuration filters..." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,200px)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="config_profile">User Profile</Label>
                <select
                  id="config_profile"
                  className={erpSelectClass}
                  value={configProfile}
                  onChange={(event) => {
                    const nextProfile = event.target.value as MobileConfigProfile;
                    setConfigProfile(nextProfile);
                    setEditInput(emptyConfigInput(nextProfile));
                  }}
                >
                  {configProfiles.map((profile) => (
                    <option key={profile} value={profile}>
                      {profile}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                />
                Include In-active Menu
              </label>

              <Button onClick={() => void searchConfig()} disabled={configLoading || !permissions.view}>
                {configLoading ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Search
              </Button>
            </div>

            {!configSearched ? (
              <ErpEmpty title="Search a profile to load the mobile app menu configuration." />
            ) : configLoading ? (
              <ErpLoading label="Loading mobile app menu configuration..." />
            ) : configRows.length === 0 ? (
              <ErpEmpty
                title="No mobile app menu records were found."
                hint="Try changing the profile filter or include inactive records."
              />
            ) : (
              <RecordTable
                rows={configRows}
                columns={configColumns}
                getRowKey={(row) => row.id}
                searchPlaceholder="Search mobile menu records..."
                exportFilename="mobile-app-menu-rights"
                exportTitle="Mobile App Menu Rights"
                emptyTitle="No records found."
                actions={(row) => (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!permissions.edit}
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                )}
              />
            )}
          </div>
        )}
      </ErpSection>

      <Modal
        open={editing !== null}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
        title="Update Menu Sub-menu"
        description="This updates the selected record and cascades grouped main-title fields the same way the old Laravel controller does."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveConfig()} disabled={editSaving || !editing}>
              {editSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="main_title">Main Title</Label>
            <Input
              id="main_title"
              value={editInput.mainTitle}
              onChange={(event) => setEditInput((current) => ({ ...current, mainTitle: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="main_title_color_code">Main Title Color Code</Label>
            <div className="flex gap-2">
              <Input
                id="main_title_color_code"
                type="color"
                value={editInput.mainTitleColorCode || "#000000"}
                onChange={(event) =>
                  setEditInput((current) => ({ ...current, mainTitleColorCode: event.target.value }))
                }
                className="h-11 w-20 p-1"
              />
              <Input
                value={editInput.mainTitleColorCode}
                onChange={(event) =>
                  setEditInput((current) => ({ ...current, mainTitleColorCode: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="main_title_background_image">Main Title Background Image</Label>
            <Input
              id="main_title_background_image"
              value={editInput.mainTitleBackgroundImage}
              onChange={(event) =>
                setEditInput((current) => ({ ...current, mainTitleBackgroundImage: event.target.value }))
              }
            />
            <div>{previewImage(editInput.mainTitleBackgroundImage, "Background preview")}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="main_sort_order">Main Sort Order</Label>
            <select
              id="main_sort_order"
              className={erpSelectClass}
              value={editInput.mainSortOrder}
              onChange={(event) =>
                setEditInput((current) => ({ ...current, mainSortOrder: Number(event.target.value) }))
              }
            >
              {sortOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub_title_of_main">Sub Title of Main</Label>
            <Input
              id="sub_title_of_main"
              value={editInput.subTitleOfMain}
              onChange={(event) =>
                setEditInput((current) => ({ ...current, subTitleOfMain: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="sub_title_icon">Sub Title Icon</Label>
            <Input
              id="sub_title_icon"
              value={editInput.subTitleIcon}
              onChange={(event) => setEditInput((current) => ({ ...current, subTitleIcon: event.target.value }))}
            />
            <div>{previewImage(editInput.subTitleIcon, "Icon preview")}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub_title_sort_order">Sub Title Sort Order</Label>
            <select
              id="sub_title_sort_order"
              className={erpSelectClass}
              value={editInput.subTitleSortOrder}
              onChange={(event) =>
                setEditInput((current) => ({ ...current, subTitleSortOrder: Number(event.target.value) }))
              }
            >
              {sortOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className={erpSelectClass}
              value={editInput.status}
              onChange={(event) =>
                setEditInput((current) => ({
                  ...current,
                  status: event.target.value === "No" ? "No" : "Yes",
                }))
              }
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        </div>
      </Modal>
    </main>
  );
}
