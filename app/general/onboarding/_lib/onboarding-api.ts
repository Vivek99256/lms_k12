<<<<<<< HEAD
=======
// 'use client';

// import {
//   buildSessionContext,
//   createAuthHeaders,
//   readNumber,
//   readString,
//   type SessionContext,
// } from '@/lib/erp-client';

// /**
//  * Client for the module-wise onboarding API (routes/api.php, prefix
//  * `onboarding-modules`, middleware `api.session`).
//  *
//  * That route group performs real JWT validation and derives the tenant from the
//  * validated token payload, so — unlike the older `type=API` screens — the
//  * sub_institute_id sent here is a hint, never the authority. The Bearer token is
//  * therefore mandatory.
//  */

// export type StepStatus =
//   | 'pending'
//   | 'in_progress'
//   | 'completed'
//   | 'skipped'
//   | 'blocked'
//   | 'misconfigured';

// export type StepOwner = 'TRIZ' | 'SCHOOL';

// export type OnboardingSummary = {
//   totalSteps: number;
//   requiredSteps: number;
//   completedSteps: number;
//   requiredCompleted: number;
//   percentComplete: number;
//   byStatus: Record<string, number>;
//   isComplete: boolean;
// };

// export type OnboardingStep = {
//   id: number;
//   stepKey: string;
//   title: string;
//   description: string;
//   sortOrder: number;
//   isRequired: boolean;
//   owner: StepOwner;
//   trizRole: string;
//   schoolRole: string;
//   status: StepStatus;
//   isComplete: boolean;
//   proof: {
//     type: 'table_rows' | 'manual' | 'none';
//     table: string;
//     scope: 'tenant' | 'tenant_year' | 'global';
//     minRows: number;
//     rowCount: number | null;
//     atLeast: boolean;
//     satisfied: boolean;
//     state: string;
//     reason: string;
//   };
//   action: {
//     route: string;
//     menuId: number | null;
//     youtubeLink: string;
//     pdfLink: string;
//   };
//   state: {
//     manualStatus: StepStatus | '';
//     notes: string;
//     assignedToId: number | null;
//     assignedToName: string;
//     updatedByName: string;
//     completedAt: string;
//     updatedAt: string;
//   };
// };

// export type OnboardingModule = {
//   id: number;
//   moduleKey: string;
//   moduleName: string;
//   menuTitle: string;
//   description: string;
//   icon: string;
//   sortOrder: number;
//   isTenantOverride: boolean;
// };

// export type OnboardingModuleOverview = OnboardingModule & {
//   summary: OnboardingSummary;
//   nextStep: { id: number; stepKey: string; title: string; owner: StepOwner; status: StepStatus } | null;
// };

// export type OnboardingOverview = {
//   modules: OnboardingModuleOverview[];
//   summary: OnboardingSummary;
//   context: { subInstituteId: string; syear: string; schoolName: string; currentUserName: string };
// };

// export type OnboardingMenu = {
//   id: number;
//   name: string;
//   link: string;
//   menuType: string;
//   icon: string;
//   youtubeLink: string;
//   pdfLink: string;
//   databaseTable: string;
// };

// /** A member of staff at this institute, read live from `tbluser`. */
// export type OnboardingUser = {
//   id: number;
//   name: string;
//   profileName: string;
// };

// export type OnboardingResources = {
//   menus: OnboardingMenu[];
//   requirements: string;
//   importFields: Record<string, { field_name?: string; display_name?: string; is_required?: number }[]>;
//   responsibilities: { profileName: string; text: string }[];
//   users: OnboardingUser[];
// };

// export type OnboardingJourney = {
//   module: OnboardingModule;
//   steps: OnboardingStep[];
//   summary: OnboardingSummary;
//   resources: OnboardingResources;
//   context: { subInstituteId: string; syear: string; currentUserName: string };
// };

// type UnknownRecord = Record<string, unknown>;

// function isRecord(value: unknown): value is UnknownRecord {
//   return Boolean(value && typeof value === 'object' && !Array.isArray(value));
// }

// function record(value: unknown): UnknownRecord {
//   return isRecord(value) ? value : {};
// }

// function list(value: unknown): UnknownRecord[] {
//   return Array.isArray(value) ? value.filter(isRecord) : [];
// }

// function readBool(value: unknown): boolean {
//   return value === true || value === 1 || value === '1';
// }

// export function errorMessage(error: unknown, fallback: string): string {
//   if (error instanceof Error && error.message) return error.message;
//   return fallback;
// }

// function requireSession(): SessionContext {
//   const session = buildSessionContext();

//   if (!session.token) {
//     throw new Error('Your session has expired. Sign in again to continue onboarding.');
//   }

//   return session;
// }

// async function request<T>(
//   path: string,
//   init: RequestInit,
//   parse: (payload: unknown) => T
// ): Promise<T> {
//   const session = requireSession();
//   const url = new URL(`${session.baseUrl}/api/onboarding-modules/${path}`);

//   // `api.session` reads the tenant from the token; syear is the one value the
//   // caller is allowed to steer, so the year switcher in the header keeps working.
//   if (session.syear) url.searchParams.set('syear', session.syear);
//   if (session.termId) url.searchParams.set('term_id', session.termId);

//   let response: Response;
//   try {
//     response = await fetch(url.toString(), {
//       ...init,
//       headers: { ...createAuthHeaders(session, 'application/json'), ...(init.headers ?? {}) },
//       cache: 'no-store',
//     });
//   } catch {
//     throw new Error('Could not reach the server. Check your connection and try again.');
//   }

//   let payload: unknown = null;
//   try {
//     payload = await response.json();
//   } catch {
//     payload = null;
//   }

//   const envelope = record(payload);

//   if (!response.ok || String(envelope.status ?? envelope.status_code ?? '') !== '1') {
//     throw new Error(
//       readString(envelope.message) ||
//       (response.status === 401
//         ? 'Your session has expired. Sign in again to continue.'
//         : `Request failed (${response.status}).`)
//     );
//   }

//   return parse(envelope.data);
// }

// function normalizeSummary(value: unknown): OnboardingSummary {
//   const data = record(value);
//   const byStatus = record(data.by_status);

//   return {
//     totalSteps: readNumber(data.total_steps),
//     requiredSteps: readNumber(data.required_steps),
//     completedSteps: readNumber(data.completed_steps),
//     requiredCompleted: readNumber(data.required_completed),
//     percentComplete: readNumber(data.percent_complete),
//     byStatus: Object.fromEntries(
//       Object.entries(byStatus).map(([key, count]) => [key, readNumber(count)])
//     ),
//     isComplete: readBool(data.is_complete),
//   };
// }

// function normalizeModule(value: unknown): OnboardingModule {
//   const data = record(value);

//   return {
//     id: readNumber(data.id),
//     moduleKey: readString(data.module_key),
//     moduleName: readString(data.module_name),
//     menuTitle: readString(data.menu_title),
//     description: readString(data.description),
//     icon: readString(data.icon),
//     sortOrder: readNumber(data.sort_order),
//     isTenantOverride: readBool(data.is_tenant_override),
//   };
// }

// function normalizeStep(value: unknown): OnboardingStep {
//   const data = record(value);
//   const proof = record(data.proof);
//   const action = record(data.action);
//   const state = record(data.state);

//   return {
//     id: readNumber(data.id),
//     stepKey: readString(data.step_key),
//     title: readString(data.title),
//     description: readString(data.description),
//     sortOrder: readNumber(data.sort_order),
//     isRequired: readBool(data.is_required),
//     owner: readString(data.owner) === 'TRIZ' ? 'TRIZ' : 'SCHOOL',
//     trizRole: readString(data.triz_role),
//     schoolRole: readString(data.school_role),
//     status: (readString(data.status) || 'pending') as StepStatus,
//     isComplete: readBool(data.is_complete),
//     proof: {
//       type: (readString(proof.type) || 'manual') as OnboardingStep['proof']['type'],
//       table: readString(proof.table),
//       scope: (readString(proof.scope) || 'tenant') as OnboardingStep['proof']['scope'],
//       minRows: readNumber(proof.min_rows),
//       rowCount: proof.row_count == null ? null : readNumber(proof.row_count),
//       atLeast: readBool(proof.at_least),
//       satisfied: readBool(proof.satisfied),
//       state: readString(proof.state),
//       reason: readString(proof.reason),
//     },
//     action: {
//       route: readString(action.route),
//       menuId: action.menu_id == null ? null : readNumber(action.menu_id),
//       youtubeLink: readString(action.youtube_link),
//       pdfLink: readString(action.pdf_link),
//     },
//     state: {
//       manualStatus: (readString(state.manual_status) || '') as StepStatus | '',
//       notes: readString(state.notes),
//       assignedToId: state.assigned_to_id == null ? null : readNumber(state.assigned_to_id),
//       assignedToName: readString(state.assigned_to_name),
//       updatedByName: readString(state.updated_by_name),
//       completedAt: readString(state.completed_at),
//       updatedAt: readString(state.updated_at),
//     },
//   };
// }

// export async function loadOnboardingOverview(): Promise<OnboardingOverview> {
//   return request('overview', { method: 'GET' }, (payload) => {
//     const data = record(payload);
//     const context = record(data.context);

//     return {
//       modules: list(data.modules).map((item) => ({
//         ...normalizeModule(item),
//         summary: normalizeSummary(item.summary),
//         nextStep: isRecord(item.next_step)
//           ? {
//             id: readNumber(item.next_step.id),
//             stepKey: readString(item.next_step.step_key),
//             title: readString(item.next_step.title),
//             owner: readString(item.next_step.owner) === 'TRIZ' ? 'TRIZ' : 'SCHOOL',
//             status: (readString(item.next_step.status) || 'pending') as StepStatus,
//           }
//           : null,
//       })),
//       summary: normalizeSummary(data.summary),
//       context: {
//         subInstituteId: readString(context.sub_institute_id),
//         syear: readString(context.syear),
//         schoolName: readString(context.school_name),
//         currentUserName: readString(context.current_user_name),
//       },
//     };
//   });
// }

// export async function loadModuleJourney(moduleKey: string): Promise<OnboardingJourney> {
//   return request(`modules/${encodeURIComponent(moduleKey)}`, { method: 'GET' }, (payload) => {
//     const data = record(payload);
//     const resources = record(data.resources);

//     return {
//       module: normalizeModule(data.module),
//       steps: list(data.steps).map(normalizeStep).sort((a, b) => a.sortOrder - b.sortOrder),
//       summary: normalizeSummary(data.summary),
//       resources: {
//         menus: list(resources.menus).map((menu) => ({
//           id: readNumber(menu.id),
//           name: readString(menu.name),
//           link: readString(menu.link),
//           menuType: readString(menu.menu_type),
//           icon: readString(menu.icon),
//           youtubeLink: readString(menu.youtube_link),
//           pdfLink: readString(menu.pdf_link),
//           databaseTable: readString(menu.database_table),
//         })),
//         requirements: readString(resources.requirements),
//         importFields: isRecord(resources.import_fields)
//           ? (resources.import_fields as OnboardingResources['importFields'])
//           : {},
//         responsibilities: list(resources.responsibilities).map((item) => ({
//           profileName: readString(item.profile_name),
//           text: readString(item.text),
//         })),
//         users: list(resources.users)
//           .map((item) => ({
//             id: readNumber(item.id),
//             name: readString(item.name),
//             profileName: readString(item.profile_name),
//           }))
//           .filter((user) => user.id > 0 && user.name !== ''),
//       },
//       context: {
//         subInstituteId: readString(record(data.context).sub_institute_id),
//         syear: readString(record(data.context).syear),
//         currentUserName: readString(record(data.context).current_user_name),
//       },
//     };
//   });
// }

// export type StepUpdate = {
//   status?: StepStatus;
//   notes?: string;
//   assignedToId?: number;
//   assignedToName?: string;
// };

// export async function updateOnboardingStep(
//   stepId: number,
//   update: StepUpdate
// ): Promise<{ step: OnboardingStep; summary: OnboardingSummary }> {
//   const body: UnknownRecord = {};
//   if (update.status) body.status = update.status;
//   if (update.notes !== undefined) body.notes = update.notes;
//   if (update.assignedToId !== undefined) body.assigned_to_id = update.assignedToId;
//   if (update.assignedToName !== undefined) body.assigned_to_name = update.assignedToName;

//   return request(
//     `steps/${stepId}`,
//     { method: 'POST', body: JSON.stringify(body) },
//     (payload) => {
//       const data = record(payload);

//       return {
//         step: normalizeStep(data.step),
//         summary: normalizeSummary(data.summary),
//       };
//     }
//   );
// }


>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
'use client';

import {
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
<<<<<<< HEAD
 * Client for the module-wise onboarding API (routes/api.php, prefix `onboarding`,
 * middleware `api.session`).
=======
 * Client for the module-wise onboarding API (routes/api.php, prefix
 * `onboarding-modules`, middleware `api.session`).
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
 *
 * That route group performs real JWT validation and derives the tenant from the
 * validated token payload, so — unlike the older `type=API` screens — the
 * sub_institute_id sent here is a hint, never the authority. The Bearer token is
 * therefore mandatory.
 */

export type StepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'blocked'
  | 'misconfigured';

export type StepOwner = 'TRIZ' | 'SCHOOL';

export type OnboardingSummary = {
  totalSteps: number;
  requiredSteps: number;
  completedSteps: number;
  requiredCompleted: number;
  percentComplete: number;
  byStatus: Record<string, number>;
  isComplete: boolean;
};

export type OnboardingStep = {
  id: number;
  stepKey: string;
  title: string;
  description: string;
  sortOrder: number;
  isRequired: boolean;
  owner: StepOwner;
  trizRole: string;
  schoolRole: string;
  status: StepStatus;
  isComplete: boolean;
  proof: {
    type: 'table_rows' | 'manual' | 'none';
    table: string;
    scope: 'tenant' | 'tenant_year' | 'global';
    minRows: number;
    rowCount: number | null;
    atLeast: boolean;
    satisfied: boolean;
    state: string;
    reason: string;
  };
  action: {
    route: string;
    menuId: number | null;
    youtubeLink: string;
    pdfLink: string;
<<<<<<< HEAD
=======
    quickMenu: string;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  };
  state: {
    manualStatus: StepStatus | '';
    notes: string;
    assignedToId: number | null;
    assignedToName: string;
    updatedByName: string;
    completedAt: string;
    updatedAt: string;
  };
};

export type OnboardingModule = {
  id: number;
  moduleKey: string;
  moduleName: string;
  menuTitle: string;
  description: string;
  icon: string;
  sortOrder: number;
  isTenantOverride: boolean;
};

export type OnboardingModuleOverview = OnboardingModule & {
  summary: OnboardingSummary;
  nextStep: { id: number; stepKey: string; title: string; owner: StepOwner; status: StepStatus } | null;
};

export type OnboardingOverview = {
  modules: OnboardingModuleOverview[];
  summary: OnboardingSummary;
<<<<<<< HEAD
  context: { subInstituteId: string; syear: string; schoolName: string; currentUserName: string };
=======
  context: { subInstituteId: string; syear: string; schoolName: string; currentUserName: string; currentUserOwner: StepOwner };
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
};

export type OnboardingMenu = {
  id: number;
  name: string;
  link: string;
  menuType: string;
  icon: string;
  youtubeLink: string;
  pdfLink: string;
  databaseTable: string;
};

/** A member of staff at this institute, read live from `tbluser`. */
export type OnboardingUser = {
  id: number;
  name: string;
  profileName: string;
};

export type OnboardingResources = {
  menus: OnboardingMenu[];
  requirements: string;
  importFields: Record<string, { field_name?: string; display_name?: string; is_required?: number }[]>;
  responsibilities: { profileName: string; text: string }[];
  users: OnboardingUser[];
};

export type OnboardingJourney = {
  module: OnboardingModule;
  steps: OnboardingStep[];
  summary: OnboardingSummary;
  resources: OnboardingResources;
  context: { subInstituteId: string; syear: string; currentUserName: string };
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function record(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function requireSession(): SessionContext {
  const session = buildSessionContext();

  if (!session.token) {
    throw new Error('Your session has expired. Sign in again to continue onboarding.');
  }

  return session;
}

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (payload: unknown) => T
): Promise<T> {
  const session = requireSession();
<<<<<<< HEAD
  const url = new URL(`${session.baseUrl}/api/onboarding/${path}`);
=======
  const url = new URL(`${session.baseUrl}/api/onboarding-modules/${path}`);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  // `api.session` reads the tenant from the token; syear is the one value the
  // caller is allowed to steer, so the year switcher in the header keeps working.
  if (session.syear) url.searchParams.set('syear', session.syear);
  if (session.termId) url.searchParams.set('term_id', session.termId);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...init,
      headers: { ...createAuthHeaders(session, 'application/json'), ...(init.headers ?? {}) },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const envelope = record(payload);

  if (!response.ok || String(envelope.status ?? envelope.status_code ?? '') !== '1') {
    throw new Error(
      readString(envelope.message) ||
      (response.status === 401
        ? 'Your session has expired. Sign in again to continue.'
        : `Request failed (${response.status}).`)
    );
  }

  return parse(envelope.data);
}

function normalizeSummary(value: unknown): OnboardingSummary {
  const data = record(value);
  const byStatus = record(data.by_status);

  return {
    totalSteps: readNumber(data.total_steps),
    requiredSteps: readNumber(data.required_steps),
    completedSteps: readNumber(data.completed_steps),
    requiredCompleted: readNumber(data.required_completed),
    percentComplete: readNumber(data.percent_complete),
    byStatus: Object.fromEntries(
      Object.entries(byStatus).map(([key, count]) => [key, readNumber(count)])
    ),
    isComplete: readBool(data.is_complete),
  };
}

function normalizeModule(value: unknown): OnboardingModule {
  const data = record(value);

  return {
    id: readNumber(data.id),
    moduleKey: readString(data.module_key),
    moduleName: readString(data.module_name),
    menuTitle: readString(data.menu_title),
    description: readString(data.description),
    icon: readString(data.icon),
    sortOrder: readNumber(data.sort_order),
    isTenantOverride: readBool(data.is_tenant_override),
  };
}

function normalizeStep(value: unknown): OnboardingStep {
  const data = record(value);
  const proof = record(data.proof);
  const action = record(data.action);
  const state = record(data.state);

  return {
    id: readNumber(data.id),
    stepKey: readString(data.step_key),
    title: readString(data.title),
    description: readString(data.description),
    sortOrder: readNumber(data.sort_order),
    isRequired: readBool(data.is_required),
    owner: readString(data.owner) === 'TRIZ' ? 'TRIZ' : 'SCHOOL',
    trizRole: readString(data.triz_role),
    schoolRole: readString(data.school_role),
    status: (readString(data.status) || 'pending') as StepStatus,
    isComplete: readBool(data.is_complete),
    proof: {
      type: (readString(proof.type) || 'manual') as OnboardingStep['proof']['type'],
      table: readString(proof.table),
      scope: (readString(proof.scope) || 'tenant') as OnboardingStep['proof']['scope'],
      minRows: readNumber(proof.min_rows),
      rowCount: proof.row_count == null ? null : readNumber(proof.row_count),
      atLeast: readBool(proof.at_least),
      satisfied: readBool(proof.satisfied),
      state: readString(proof.state),
      reason: readString(proof.reason),
    },
    action: {
      route: readString(action.route),
      menuId: action.menu_id == null ? null : readNumber(action.menu_id),
      youtubeLink: readString(action.youtube_link),
      pdfLink: readString(action.pdf_link),
<<<<<<< HEAD
=======
      quickMenu: readString(action.quick_menu),
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    },
    state: {
      manualStatus: (readString(state.manual_status) || '') as StepStatus | '',
      notes: readString(state.notes),
      assignedToId: state.assigned_to_id == null ? null : readNumber(state.assigned_to_id),
      assignedToName: readString(state.assigned_to_name),
      updatedByName: readString(state.updated_by_name),
      completedAt: readString(state.completed_at),
      updatedAt: readString(state.updated_at),
    },
  };
}

export async function loadOnboardingOverview(): Promise<OnboardingOverview> {
<<<<<<< HEAD
=======
  const session = buildSessionContext();
  const isAdmin = Number(session.isAdmin);
  const currentUserOwner: StepOwner = isAdmin >= 2 ? 'TRIZ' : 'SCHOOL';

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  return request('overview', { method: 'GET' }, (payload) => {
    const data = record(payload);
    const context = record(data.context);

    return {
      modules: list(data.modules).map((item) => ({
        ...normalizeModule(item),
        summary: normalizeSummary(item.summary),
        nextStep: isRecord(item.next_step)
          ? {
            id: readNumber(item.next_step.id),
            stepKey: readString(item.next_step.step_key),
            title: readString(item.next_step.title),
            owner: readString(item.next_step.owner) === 'TRIZ' ? 'TRIZ' : 'SCHOOL',
            status: (readString(item.next_step.status) || 'pending') as StepStatus,
          }
          : null,
      })),
      summary: normalizeSummary(data.summary),
      context: {
        subInstituteId: readString(context.sub_institute_id),
        syear: readString(context.syear),
        schoolName: readString(context.school_name),
        currentUserName: readString(context.current_user_name),
<<<<<<< HEAD
=======
        currentUserOwner,
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      },
    };
  });
}

export async function loadModuleJourney(moduleKey: string): Promise<OnboardingJourney> {
  return request(`modules/${encodeURIComponent(moduleKey)}`, { method: 'GET' }, (payload) => {
    const data = record(payload);
    const resources = record(data.resources);

    return {
      module: normalizeModule(data.module),
      steps: list(data.steps).map(normalizeStep).sort((a, b) => a.sortOrder - b.sortOrder),
      summary: normalizeSummary(data.summary),
      resources: {
        menus: list(resources.menus).map((menu) => ({
          id: readNumber(menu.id),
          name: readString(menu.name),
          link: readString(menu.link),
          menuType: readString(menu.menu_type),
          icon: readString(menu.icon),
          youtubeLink: readString(menu.youtube_link),
          pdfLink: readString(menu.pdf_link),
          databaseTable: readString(menu.database_table),
        })),
        requirements: readString(resources.requirements),
        importFields: isRecord(resources.import_fields)
          ? (resources.import_fields as OnboardingResources['importFields'])
          : {},
        responsibilities: list(resources.responsibilities).map((item) => ({
          profileName: readString(item.profile_name),
          text: readString(item.text),
        })),
        users: list(resources.users)
          .map((item) => ({
            id: readNumber(item.id),
            name: readString(item.name),
            profileName: readString(item.profile_name),
          }))
          .filter((user) => user.id > 0 && user.name !== ''),
      },
      context: {
        subInstituteId: readString(record(data.context).sub_institute_id),
        syear: readString(record(data.context).syear),
        currentUserName: readString(record(data.context).current_user_name),
      },
    };
  });
}

export type StepUpdate = {
  status?: StepStatus;
  notes?: string;
  assignedToId?: number;
  assignedToName?: string;
};

export async function updateOnboardingStep(
  stepId: number,
  update: StepUpdate
): Promise<{ step: OnboardingStep; summary: OnboardingSummary }> {
  const body: UnknownRecord = {};
  if (update.status) body.status = update.status;
  if (update.notes !== undefined) body.notes = update.notes;
  if (update.assignedToId !== undefined) body.assigned_to_id = update.assignedToId;
  if (update.assignedToName !== undefined) body.assigned_to_name = update.assignedToName;

  return request(
    `steps/${stepId}`,
    { method: 'POST', body: JSON.stringify(body) },
    (payload) => {
      const data = record(payload);

      return {
        step: normalizeStep(data.step),
        summary: normalizeSummary(data.summary),
      };
    }
  );
}
