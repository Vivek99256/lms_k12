import test from "node:test";
import assert from "node:assert/strict";
import { getAiTemplateIntent } from "./adapter";
import { getAllowedToolNamesForProfile, getLmsToolDefinitions } from "./tools";

/* -------------------------------------------------------------------------- */
/* The AI category is a category of the existing library, not a new store      */
/* -------------------------------------------------------------------------- */

test("template questions route to the library, not to the model", () => {
  assert.equal(
    getAiTemplateIntent("which ai templates are available?")?.suggestedTool,
    "listAiTemplates"
  );
  assert.equal(
    getAiTemplateIntent("show me the templates")?.suggestedTool,
    "listAiTemplates"
  );
  assert.equal(
    getAiTemplateIntent("list all templates")?.suggestedTool,
    "listAiTemplates"
  );
});

test("using a named template loads that one template", () => {
  assert.equal(
    getAiTemplateIntent("use the intervention letter template")?.suggestedTool,
    "getAiTemplate"
  );
  assert.equal(
    getAiTemplateIntent("open the fee reminder template")?.suggestedTool,
    "getAiTemplate"
  );
  assert.equal(
    getAiTemplateIntent("draft with the admission offer template")?.suggestedTool,
    "getAiTemplate"
  );
});

test("designing and editing stay with the designer screens", () => {
  // The assistant reads the library. Creation, editing and publishing belong to
  // /document-templates, which already owns them.
  assert.equal(getAiTemplateIntent("create a new template"), null);
  assert.equal(getAiTemplateIntent("edit the fee receipt template"), null);
  assert.equal(getAiTemplateIntent("delete that template"), null);
  assert.equal(getAiTemplateIntent("publish the template"), null);
});

test("messages that are not about templates are left alone", () => {
  assert.equal(getAiTemplateIntent("how many students are there?"), null);
  assert.equal(getAiTemplateIntent("which students have pending fees?"), null);
  assert.equal(getAiTemplateIntent("show me the merit report"), null);
});

test("both template tools are registered and read-only", () => {
  const definitions = getLmsToolDefinitions();

  for (const name of ["listAiTemplates", "getAiTemplate"]) {
    const definition = definitions.find((candidate) => candidate.name === name);
    assert.ok(definition, `${name} should be a registered tool`);
    assert.equal(definition?.requiresConfirmation, false);
    assert.equal(definition?.riskLevel, "low");
    assert.deepEqual(definition?.requiredPermissions, ["lms:document_template:read"]);
  }
});

test("staff profiles may read the library; students may not", () => {
  for (const profile of ["admin", "teacher"]) {
    const allowed = getAllowedToolNamesForProfile(profile);
    assert.ok(allowed.includes("listAiTemplates"), `${profile} should read templates`);
    assert.ok(allowed.includes("getAiTemplate"), `${profile} should read templates`);
  }

  const student = getAllowedToolNamesForProfile("student");
  assert.equal(student.includes("listAiTemplates"), false);
  assert.equal(student.includes("getAiTemplate"), false);
});
