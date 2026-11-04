import assert from "node:assert/strict";
import { test } from "node:test";

import { parseStaffCompetency } from "./staff-competency";

test("parses skills, job role and only real gaps", () => {
  const result = parseStaffCompetency({
    employee: { name: "Synthetic Person", role: "Analyst", department: "N/A" },
    metrics: { overall_score: 3.5, latest_assessment: "N/A" },
    competencies: [
      { category: "Tech", items: [
        { skill_id: 1, name: "SQL", required: 4, current: 2, gap: -2 },
        { skill_id: 2, name: "Excel", required: 3, current: 5, gap: 2 },
        { skill_id: 3, name: "Extra", required: 0, current: 1, gap: 1 },
      ] },
    ],
  });
  assert.equal(result.jobRole, "Analyst");
  assert.equal(result.department, null);
  assert.equal(result.latestAssessment, null);
  assert.equal(result.skills.length, 3);
  assert.deepEqual(result.gaps.map((g) => g.name), ["SQL"]);
});

test("tolerates empty or malformed payloads", () => {
  const result = parseStaffCompetency(null);
  assert.equal(result.skills.length, 0);
  assert.equal(result.jobRole, null);
});
