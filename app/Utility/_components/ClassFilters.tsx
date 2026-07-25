"use client";

import { Label } from "@/components/ui/label";
import {
  divisionsForStandard,
  standardsForGrade,
  type ClassOptions,
} from "../_lib/classOptions";
import { utilitySelectClass } from "./utility-ui";

export type ClassSelection = {
  gradeId: string;
  standardId: string;
  divisionId: string;
};

export const emptyClassSelection: ClassSelection = {
  gradeId: "",
  standardId: "",
  divisionId: "",
};

/**
 * Chained grade → standard → division dropdowns, the React equivalent of the
 * Blade `SearchChain()` helper used by every Utility screen. Selecting a parent
 * clears its dependants exactly as the legacy jQuery handlers do.
 */
export function ClassFilters({
  idPrefix,
  options,
  value,
  onChange,
  disabled = false,
  required = true,
  showDivision = true,
  labels,
}: {
  idPrefix: string;
  options: ClassOptions;
  value: ClassSelection;
  onChange: (next: ClassSelection) => void;
  disabled?: boolean;
  required?: boolean;
  showDivision?: boolean;
  labels?: { grade?: string; standard?: string; division?: string };
}) {
  const standards = standardsForGrade(options, value.gradeId);
  const divisions = divisionsForStandard(options, value.standardId);
  const suffix = required ? " *" : "";

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-grade`}>{(labels?.grade ?? "Academic section") + suffix}</Label>
        <select
          id={`${idPrefix}-grade`}
          className={utilitySelectClass}
          value={value.gradeId}
          disabled={disabled}
          required={required}
          onChange={(event) =>
            onChange({ gradeId: event.target.value, standardId: "", divisionId: "" })
          }
        >
          <option value="">Select</option>
          {options.academicSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-standard`}>{(labels?.standard ?? "Standard") + suffix}</Label>
        <select
          id={`${idPrefix}-standard`}
          className={utilitySelectClass}
          value={value.standardId}
          disabled={disabled || !value.gradeId}
          required={required}
          onChange={(event) =>
            onChange({ ...value, standardId: event.target.value, divisionId: "" })
          }
        >
          <option value="">Select</option>
          {standards.map((standard) => (
            <option key={standard.id} value={standard.id}>
              {standard.name}
            </option>
          ))}
        </select>
      </div>

      {showDivision ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-division`}>{(labels?.division ?? "Division") + suffix}</Label>
          <select
            id={`${idPrefix}-division`}
            className={utilitySelectClass}
            value={value.divisionId}
            disabled={disabled || !value.standardId}
            required={required}
            onChange={(event) => onChange({ ...value, divisionId: event.target.value })}
          >
            <option value="">Select</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}
