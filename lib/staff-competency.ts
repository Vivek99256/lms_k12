/**
 * Staff (tbluser) <-> People & Competency read model for the Users screen.
 *
 * Reads the existing, authorization-checked endpoint
 * GET /api/competency/employee-profiles/{id} (tenant-scoped, own-profile or
 * elevated role only) and reshapes it into skills / job role / gaps.
 * Read-only: nothing here writes.
 */

export type StaffSkill = {
  skillId: number;
  name: string;
  category: string;
  current: number;
  required: number;
  gap: number;
  assessor: string;
  date: string;
};

export type StaffCompetency = {
  name: string;
  jobRole: string | null;
  department: string | null;
  overallScore: number;
  latestAssessment: string | null;
  skills: StaffSkill[];
  gaps: StaffSkill[];
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const known = (v: unknown) => {
  const s = str(v).trim();
  return s && s !== "N/A" ? s : null;
};

/** Parse the `data` object of the employee-profiles `show` response. */
export function parseStaffCompetency(data: unknown): StaffCompetency {
  const root = isRecord(data) ? data : {};
  const employee = isRecord(root.employee) ? root.employee : {};
  const metrics = isRecord(root.metrics) ? root.metrics : {};
  const skills: StaffSkill[] = [];
  for (const group of Array.isArray(root.competencies) ? root.competencies : []) {
    if (!isRecord(group)) continue;
    for (const item of Array.isArray(group.items) ? group.items : []) {
      if (!isRecord(item)) continue;
      skills.push({
        skillId: num(item.skill_id),
        name: str(item.name),
        category: str(group.category) || "General Competencies",
        current: num(item.current),
        required: num(item.required),
        gap: num(item.gap),
        assessor: str(item.assessor),
        date: str(item.date),
      });
    }
  }
  return {
    name: str(employee.name),
    jobRole: known(employee.role),
    department: known(employee.department),
    overallScore: num(metrics.overall_score),
    latestAssessment: known(metrics.latest_assessment),
    skills,
    // A gap only exists where the job role defines a required level
    // and the staff member is below it.
    gaps: skills.filter((s) => s.required > 0 && s.current < s.required).sort((a, b) => a.gap - b.gap),
  };
}
