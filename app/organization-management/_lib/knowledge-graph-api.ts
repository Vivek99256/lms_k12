'use client';

/**
 * Organization Management Knowledge Graph client.
 *
 *   GET /organization-management/knowledge-graph?staff_per_role=25
 *
 * Read only. The backend reads the signed-in school's structure out of Neo4j and returns nodes and
 * edges; a school can have hundreds of staff, so only a sample per role comes back as nodes while
 * the real totals travel as counts.
 */

import { buildSessionContext, createAuthHeaders, type ApiEnvelope } from '@/lib/erp-client';

export type GraphNodeType = 'institute' | 'department' | 'role' | 'staff' | 'subject' | 'fact';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Institute: all staff with a role. Role / department: staff on it. Absent on staff and subjects. */
  count?: number;
  /** Staff only: the role node this person sits under. */
  role?: string;
  /** Fact nodes only: which kind of detail this is (department, class, email ...). Built in the browser from the person's card. */
  facet?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface GraphStats {
  staffTotal: number;
  staffShown: number;
  roles: number;
  departments: number;
  subjects: number;
  edges: number;
}

export interface OrgGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
}

/** One person's card for the details panel. Safe fields only; the backend never returns logins or bank details. */
export interface StaffCard {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  gender: string | null;
  city: string | null;
  qualification: string | null;
  experience: string | number | null;
  employeeNo: string | null;
  joined: string | null;
  active: boolean;
  lastLogin: string | null;
  department: string | null;
  jobRole: string | null;
  profile: string | null;
  reportsTo: string | null;
  graph: { classTeacherOf: string[]; subjects: string[]; leaveTypes: string[] };
}

export async function fetchStaffCard(staffId: string | number): Promise<StaffCard> {
  const session = buildSessionContext();
  const search = new URLSearchParams({ sub_institute_id: session.subInstituteId, syear: session.syear, user_id: session.userId, type: 'API' });

  const response = await fetch(`${session.baseUrl}/api/organization-management/knowledge-graph/staff/${encodeURIComponent(String(staffId))}?${search.toString()}`, {
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope & { data?: StaffCard };

  if (!response.ok || !payload.data) {
    const message = typeof payload.message === 'string' && payload.message.trim() ? payload.message : "Couldn't load this person's details. Try again.";
    throw new Error(message);
  }

  return payload.data;
}

export async function fetchOrgGraph(staffPerRole: number): Promise<OrgGraph> {
  const session = buildSessionContext();
  const search = new URLSearchParams({
    staff_per_role: String(staffPerRole),
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
  });

  const response = await fetch(`${session.baseUrl}/api/organization-management/knowledge-graph?${search.toString()}`, {
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope & { data?: OrgGraph };

  if (!response.ok || !payload.data) {
    const message = typeof payload.message === 'string' && payload.message.trim() ? payload.message : "Couldn't load the knowledge graph. Try again.";
    throw new Error(message);
  }

  return payload.data;
}
