/**
 * Organization Management — shared types.
 *
 * Ported from G2G's `types/employee.ts` and `services/navigation/menu-rights.ts`
 * (the `MenuRight*` / `RoleProfile` family). Field names, shapes and semantics
 * are unchanged; only the `MenuRights*Node` types were renamed
 * `MenuRights*Node` → kept identical (no rename) so `lib/role-permissions.ts`
 * (ported at `app/organization-management/_lib/role-permissions-tree.ts`)
 * type-checks against them without edits.
 */

// ---------------------------------------------------------------------------
// Employee Directory — ported from G2G's `types/employee.ts`
// ---------------------------------------------------------------------------

export interface Employee {
  id: number | string;
  full_name: string;
  email: string;
  mobile: string;
  department_name: string;
  jobRole: string;
  designation: string;
  address: string;
  image: string;
  occupation: string;
  status: string;
  /** Raw `tbluser.status` (0/1) from the list API - drives Suspend/Restore Access. Null when the source row didn't carry one. */
  status_code: number | null;
  lastActivity: string;
  join_Date: string;
  profile_name: string;
  skills: any[]; // Array of skill objects
}

/**
 * `.../employee-directory/reference-data` response payload - the option
 * lists + defaults the Add Employee flow needs. Ported from G2G's
 * `services/organization/employee-directory.ts` `ReferenceData` type.
 */
export interface ReferenceData {
  departments: { id: number; name: string; parent_id: number | null }[];
  job_roles: { id: number; name: string; department_id: number | null; category: string | null }[];
  user_profiles: { id: number; name: string }[];
  levels_of_responsibility: { id: number; level: number; guiding_phrase: string | null }[];
  managers: { id: number; first_name: string | null; last_name: string | null; employee_no: string | null }[];
  next_employee_no: string;
  default_schedule: unknown[];
}

/** Ported from G2G's `services/organization/employee-profile-service.ts`. */
export interface EmployeeProfileFullResponse {
  status_code?: number | string;
  status?: number | string;
  message?: string;
  data?: Record<string, any>;
  jobroleSkills?: any[];
  skills?: any[];
  userRatedSkills?: any[];
  jobroleTasks?: any[];
  userLevelOfResponsibility?: Record<string, any>;
  user_profiles?: any[];
  employees?: any[];
  documentTypeLists?: any[];
  documentLists?: any[];
  departments?: any[];
  jobroleList?: any[];
}

// ---------------------------------------------------------------------------
// Role & Permissions — ported from G2G's `services/navigation/menu-rights.ts`
// ---------------------------------------------------------------------------

/** Laravel returns rights as 0/1 ints, one column per action. */
export interface MenuRightFlags {
  can_view: number;
  can_add: number;
  can_edit: number;
  can_delete: number;
  dashboard_right: number;
  is_mobile: number;
}

export interface MenuRightsSubmenuNode extends MenuRightFlags {
  id: number;
  label: string;
  icon: string | null;
  access_link: string | null;
  page_type: string | null;
  sort_order: number;
}

export interface MenuRightsMenuNode extends MenuRightsSubmenuNode {
  submenus: MenuRightsSubmenuNode[];
}

export interface MenuRightsModuleNode extends MenuRightsSubmenuNode {
  menus: MenuRightsMenuNode[];
}

export interface MenuRightsResponse {
  status_code: number;
  message: string;
  data: MenuRightsModuleNode[];
}

/** A row of tbluserprofilemaster - "role" in the UI, "profile" in Laravel. */
export interface RoleProfile {
  id: number;
  name: string;
  description: string | null;
  sort_order: number | null;
  user_count: number;
}

export interface RoleProfilesResponse {
  status_code: number;
  message: string;
  data: RoleProfile[];
}

export interface MenuRightPayload extends MenuRightFlags {
  menu_id: number;
}

export interface SaveRightsResponse {
  status_code: number;
  message: string;
  data?: { saved: number };
}

export interface CreateRoleResponse {
  status_code: number;
  message: string;
  data: RoleProfile;
}
