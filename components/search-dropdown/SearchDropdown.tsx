"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  getAcademicSections,
  getDivisions,
  getStandards,
  getSubjects,
} from "./api";
import {
  type AcademicSection,
  type Division,
  type DropdownField,
  type DropdownValue,
  type SearchDropdownProps,
  type SearchDropdownValues,
  type Standard,
  type Subject,
} from "./types";

const DEFAULT_FIELDS: DropdownField[] = [
  "section",
  "standard",
  "division",
  "subject",
];

function readString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function readStoredJson(storage: Storage, key: string): Record<string, unknown> | null {
  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getStoredSessionDetails() {
  if (typeof window === "undefined") {
    return { token: "", subInstituteId: "" };
  }

  const storageSources = [sessionStorage, localStorage];

  for (const storage of storageSources) {
    const directToken = readString(storage.getItem("token"));
    const directSubInstituteId = readString(
      storage.getItem("sub_institute_id")
    );

    if (directToken || directSubInstituteId) {
      return {
        token: directToken,
        subInstituteId: directSubInstituteId,
      };
    }

    const userData = readStoredJson(storage, "userData");
    const menuContext = readStoredJson(storage, "menuContext");

    const nestedToken = readString(
      userData?.user_token ??
        userData?.token ??
        menuContext?.user_token ??
        menuContext?.token
    );
    const nestedSubInstituteId = readString(
      userData?.sub_institute_id ?? menuContext?.sub_institute_id
    );

    if (nestedToken || nestedSubInstituteId) {
      return {
        token: nestedToken,
        subInstituteId: nestedSubInstituteId,
      };
    }
  }

  return { token: "", subInstituteId: "" };
}

function normalizeValue(
  value: DropdownValue | undefined,
  isMultiple: boolean
): DropdownValue {
  if (isMultiple) {
    if (Array.isArray(value)) {
      return value.map(String);
    }

    return value ? [String(value)] : [];
  }

  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : "";
  }

  return value ? String(value) : "";
}

function getSingleValue(value: DropdownValue): string {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function getSelectedValues(
  event: ChangeEvent<HTMLSelectElement>,
  isMultiple: boolean
): DropdownValue {
  if (!isMultiple) {
    return event.target.value;
  }

  return Array.from(event.target.selectedOptions).map(
    (option) => option.value
  );
}

function getEmptyFieldValue(isMultiple: boolean): DropdownValue {
  return isMultiple ? [] : "";
}

function buildInitialValues(
  values: Partial<SearchDropdownValues> | undefined,
  multiple: SearchDropdownProps["multiple"]
): SearchDropdownValues {
  return {
    section: normalizeValue(values?.section, Boolean(multiple?.section)),
    standard: normalizeValue(values?.standard, Boolean(multiple?.standard)),
    division: normalizeValue(values?.division, Boolean(multiple?.division)),
    subject: normalizeValue(values?.subject, Boolean(multiple?.subject)),
  };
}

function areDropdownValuesEqual(
  current: SearchDropdownValues,
  next: SearchDropdownValues
): boolean {
  const fields: DropdownField[] = [
    "section",
    "standard",
    "division",
    "subject",
  ];

  return fields.every((field) => {
    const currentValue = current[field];
    const nextValue = next[field];

    if (Array.isArray(currentValue) || Array.isArray(nextValue)) {
      if (!Array.isArray(currentValue) || !Array.isArray(nextValue)) {
        return false;
      }

      if (currentValue.length !== nextValue.length) {
        return false;
      }

      return currentValue.every((value, index) => value === nextValue[index]);
    }

    return currentValue === nextValue;
  });
}

function getUniqueItemsById<T>(
  items: T[],
  getId: (item: T) => string
): T[] {
  const seenIds = new Set<string>();

  return items.filter((item) => {
    const id = getId(item);

    if (seenIds.has(id)) {
      return false;
    }

    seenIds.add(id);
    return true;
  });
}

export default function SearchDropdown({
  fields = DEFAULT_FIELDS,
  token,
  subInstituteId,
  values,
  multiple = {},
  disabled = {},
  required = {},
  labels = {},
  placeholders = {},
  className = "",
  onChange,
  onSectionChange,
  onStandardChange,
  onDivisionChange,
  onSubjectChange,
}: SearchDropdownProps) {
  const visibleFields = useMemo(() => new Set(fields), [fields]);

  const [formValues, setFormValues] = useState<SearchDropdownValues>(() =>
    buildInitialValues(values, multiple)
  );
  const [sections, setSections] = useState<AcademicSection[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<Record<DropdownField, boolean>>({
    section: false,
    standard: false,
    division: false,
    subject: false,
  });
  const [errors, setErrors] = useState<
    Partial<Record<DropdownField, string>>
  >({});

  const uniqueSections = useMemo(
    () => getUniqueItemsById(sections, (section) => String(section.id)),
    [sections]
  );
  const uniqueStandards = useMemo(
    () => getUniqueItemsById(standards, (standard) => String(standard.id)),
    [standards]
  );
  const uniqueDivisions = useMemo(
    () => getUniqueItemsById(divisions, (division) => String(division.id)),
    [divisions]
  );
  const uniqueSubjects = useMemo(
    () =>
      getUniqueItemsById(subjects, (subject) => String(subject.subject_id)),
    [subjects]
  );

  const resolvedToken = useMemo(() => {
    if (token) {
      return token;
    }

    return getStoredSessionDetails().token;
  }, [token]);

  const resolvedSubInstituteId = useMemo(() => {
    if (subInstituteId !== undefined) {
      return String(subInstituteId);
    }

    return getStoredSessionDetails().subInstituteId;
  }, [subInstituteId]);

  const setFieldLoading = useCallback(
    (field: DropdownField, status: boolean) => {
      setLoading((previous) => ({
        ...previous,
        [field]: status,
      }));
    },
    []
  );

  const setFieldError = useCallback(
    (field: DropdownField, message?: string) => {
      setErrors((previous) => ({
        ...previous,
        [field]: message,
      }));
    },
    []
  );

  const emitChange = useCallback(
    (nextValues: SearchDropdownValues, changedField: DropdownField) => {
      onChange?.(nextValues, changedField);
    },
    [onChange]
  );

  const updateValues = useCallback(
    (changedField: DropdownField, value: DropdownValue) => {
      let nextValues: SearchDropdownValues = {
        ...formValues,
        [changedField]: value,
      };

      if (changedField === "section") {
        nextValues = {
          ...nextValues,
          standard: getEmptyFieldValue(Boolean(multiple.standard)),
          division: getEmptyFieldValue(Boolean(multiple.division)),
          subject: getEmptyFieldValue(Boolean(multiple.subject)),
        };

        setStandards([]);
        setDivisions([]);
        setSubjects([]);
        setFieldError("standard");
        setFieldError("division");
        setFieldError("subject");
      }

      if (changedField === "standard") {
        nextValues = {
          ...nextValues,
          division: getEmptyFieldValue(Boolean(multiple.division)),
          subject: getEmptyFieldValue(Boolean(multiple.subject)),
        };

        setDivisions([]);
        setSubjects([]);
        setFieldError("division");
        setFieldError("subject");
      }

      setFormValues(nextValues);
      emitChange(nextValues, changedField);

      return nextValues;
    },
    [emitChange, formValues, multiple.division, multiple.standard, multiple.subject, setFieldError]
  );

  const loadSections = useCallback(async () => {
    if (
      !visibleFields.has("section") ||
      !resolvedToken ||
      !resolvedSubInstituteId
    ) {
      return;
    }

    try {
      setFieldLoading("section", true);
      setFieldError("section");

      const data = await getAcademicSections({
        token: resolvedToken,
        subInstituteId: resolvedSubInstituteId,
      });

      setSections(data);
    } catch (error) {
      setSections([]);
      setFieldError(
        "section",
        error instanceof Error
          ? error.message
          : "Unable to load sections."
      );
    } finally {
      setFieldLoading("section", false);
    }
  }, [
    resolvedSubInstituteId,
    resolvedToken,
    setFieldError,
    setFieldLoading,
    visibleFields,
  ]);

  const loadStandards = useCallback(
    async (gradeId: string) => {
      if (
        !visibleFields.has("standard") ||
        !gradeId ||
        !resolvedToken ||
        !resolvedSubInstituteId
      ) {
        return;
      }

      try {
        setFieldLoading("standard", true);
        setFieldError("standard");

        const data = await getStandards({
          token: resolvedToken,
          subInstituteId: resolvedSubInstituteId,
          gradeId,
        });

        setStandards(data);
      } catch (error) {
        setStandards([]);
        setFieldError(
          "standard",
          error instanceof Error
            ? error.message
            : "Unable to load standards."
        );
      } finally {
        setFieldLoading("standard", false);
      }
    },
    [
      resolvedSubInstituteId,
      resolvedToken,
      setFieldError,
      setFieldLoading,
      visibleFields,
    ]
  );

  const loadDivisions = useCallback(
    async (standardId: string) => {
      if (
        !visibleFields.has("division") ||
        !standardId ||
        !resolvedToken ||
        !resolvedSubInstituteId
      ) {
        return;
      }

      try {
        setFieldLoading("division", true);
        setFieldError("division");

        const data = await getDivisions({
          token: resolvedToken,
          subInstituteId: resolvedSubInstituteId,
          standardId,
        });

        setDivisions(data);
      } catch (error) {
        setDivisions([]);
        setFieldError(
          "division",
          error instanceof Error
            ? error.message
            : "Unable to load divisions."
        );
      } finally {
        setFieldLoading("division", false);
      }
    },
    [
      resolvedSubInstituteId,
      resolvedToken,
      setFieldError,
      setFieldLoading,
      visibleFields,
    ]
  );

  const loadSubjects = useCallback(
    async (standardId: string) => {
      if (
        !visibleFields.has("subject") ||
        !standardId ||
        !resolvedToken ||
        !resolvedSubInstituteId
      ) {
        return;
      }

      try {
        setFieldLoading("subject", true);
        setFieldError("subject");

        const data = await getSubjects({
          token: resolvedToken,
          subInstituteId: resolvedSubInstituteId,
          standardId,
        });

        setSubjects(data);
      } catch (error) {
        setSubjects([]);
        setFieldError(
          "subject",
          error instanceof Error
            ? error.message
            : "Unable to load subjects."
        );
      } finally {
        setFieldLoading("subject", false);
      }
    },
    [
      resolvedSubInstituteId,
      resolvedToken,
      setFieldError,
      setFieldLoading,
      visibleFields,
    ]
  );

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  useEffect(() => {
    if (!visibleFields.has("section")) {
      return;
    }

    if (resolvedToken && resolvedSubInstituteId) {
      return;
    }

    setSections([]);
    setFieldError("section", "Session token or institute is missing.");
  }, [
    resolvedSubInstituteId,
    resolvedToken,
    setFieldError,
    visibleFields,
  ]);

  useEffect(() => {
    const nextValues = buildInitialValues(values, multiple);

    setFormValues((currentValues) =>
      areDropdownValuesEqual(currentValues, nextValues)
        ? currentValues
        : nextValues
    );
  }, [
    multiple?.division,
    multiple?.section,
    multiple?.standard,
    multiple?.subject,
    values?.division,
    values?.section,
    values?.standard,
    values?.subject,
  ]);

  useEffect(() => {
    const selectedSectionId = getSingleValue(formValues.section);

    if (!selectedSectionId) {
      setStandards([]);
      return;
    }

    loadStandards(selectedSectionId);
  }, [formValues.section, loadStandards]);

  useEffect(() => {
    const selectedStandardId = getSingleValue(formValues.standard);

    if (!selectedStandardId) {
      setDivisions([]);
      setSubjects([]);
      return;
    }

    loadDivisions(selectedStandardId);
    loadSubjects(selectedStandardId);
  }, [formValues.standard, loadDivisions, loadSubjects]);

  const handleSectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = getSelectedValues(event, Boolean(multiple.section));
    updateValues("section", value);

    const selectedIds = Array.isArray(value) ? value : [value];
    const selectedData = sections.filter((section) =>
      selectedIds.includes(String(section.id))
    );

    onSectionChange?.(value, selectedData);
  };

  const handleStandardChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = getSelectedValues(event, Boolean(multiple.standard));
    updateValues("standard", value);

    const selectedIds = Array.isArray(value) ? value : [value];
    const selectedData = standards.filter((standard) =>
      selectedIds.includes(String(standard.id))
    );

    onStandardChange?.(value, selectedData);
  };

  const handleDivisionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = getSelectedValues(event, Boolean(multiple.division));
    updateValues("division", value);

    const selectedIds = Array.isArray(value) ? value : [value];
    const selectedData = divisions.filter((division) =>
      selectedIds.includes(String(division.id))
    );

    onDivisionChange?.(value, selectedData);
  };

  const handleSubjectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = getSelectedValues(event, Boolean(multiple.subject));
    updateValues("subject", value);

    const selectedIds = Array.isArray(value) ? value : [value];
    const selectedData = subjects.filter((subject) =>
      selectedIds.includes(String(subject.subject_id))
    );

    onSubjectChange?.(value, selectedData);
  };

  const selectClassName = cn(
    "w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-11 text-sm text-slate-700 outline-none transition",
    "focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
    "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
  );

  const canUseStandard = !visibleFields.has("section") || !!getSingleValue(formValues.section);
  const canUseStandardChild = !visibleFields.has("standard") || !!getSingleValue(formValues.standard);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {visibleFields.has("section") && (
        <div className="space-y-1.5">
          <label
            htmlFor="academic-section-dropdown"
            className="block text-sm font-medium text-slate-700"
          >
            {labels.section || "Section"}
            {required.section && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>

          <div className="relative">
            <select
              id="academic-section-dropdown"
              name="section_id"
              value={formValues.section}
              multiple={Boolean(multiple.section)}
              required={required.section}
              disabled={disabled.section || loading.section}
              onChange={handleSectionChange}
              className={cn(
                selectClassName,
                multiple.section ? "min-h-28 py-2 pr-4" : "h-11"
              )}
            >
              {!multiple.section && (
                <option value="">
                  {loading.section
                    ? "Loading sections..."
                    : placeholders.section || "Select Section"}
                </option>
              )}

              {uniqueSections.map((section) => (
                <option key={section.id} value={String(section.id)}>
                  {section.title}
                </option>
              ))}
            </select>
            {!multiple.section ? (
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            ) : null}
          </div>

          {errors.section && (
            <p className="text-xs text-red-600">{errors.section}</p>
          )}
        </div>
      )}

      {visibleFields.has("standard") && (
        <div className="space-y-1.5">
          <label
            htmlFor="standard-dropdown"
            className="block text-sm font-medium text-slate-700"
          >
            {labels.standard || "Standard"}
            {required.standard && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>

          <div className="relative">
            <select
              id="standard-dropdown"
              name="standard_id"
              value={formValues.standard}
              multiple={Boolean(multiple.standard)}
              required={required.standard}
              disabled={disabled.standard || loading.standard || !canUseStandard}
              onChange={handleStandardChange}
              className={cn(
                selectClassName,
                multiple.standard ? "min-h-28 py-2 pr-4" : "h-11"
              )}
            >
              {!multiple.standard && (
                <option value="">
                  {loading.standard
                    ? "Loading standards..."
                    : placeholders.standard || "Select Standard"}
                </option>
              )}

              {uniqueStandards.map((standard) => (
                <option key={standard.id} value={String(standard.id)}>
                  {standard.name}
                </option>
              ))}
            </select>
            {!multiple.standard ? (
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            ) : null}
          </div>

          {errors.standard && (
            <p className="text-xs text-red-600">{errors.standard}</p>
          )}
        </div>
      )}

      {visibleFields.has("division") && (
        <div className="space-y-1.5">
          <label
            htmlFor="division-dropdown"
            className="block text-sm font-medium text-slate-700"
          >
            {labels.division || "Division"}
            {required.division && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>

          <div className="relative">
            <select
              id="division-dropdown"
              name="division_id"
              value={formValues.division}
              multiple={Boolean(multiple.division)}
              required={required.division}
              disabled={
                disabled.division || loading.division || !canUseStandardChild
              }
              onChange={handleDivisionChange}
              className={cn(
                selectClassName,
                multiple.division ? "min-h-28 py-2 pr-4" : "h-11"
              )}
            >
              {!multiple.division && (
                <option value="">
                  {loading.division
                    ? "Loading divisions..."
                    : placeholders.division || "Select Division"}
                </option>
              )}

              {uniqueDivisions.map((division) => (
                <option key={division.id} value={String(division.id)}>
                  {division.name}
                </option>
              ))}
            </select>
            {!multiple.division ? (
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            ) : null}
          </div>

          {errors.division && (
            <p className="text-xs text-red-600">{errors.division}</p>
          )}
        </div>
      )}

      {visibleFields.has("subject") && (
        <div className="space-y-1.5">
          <label
            htmlFor="subject-dropdown"
            className="block text-sm font-medium text-slate-700"
          >
            {labels.subject || "Subject"}
            {required.subject && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>

          <select
            id="subject-dropdown"
            name="subject_id"
            value={formValues.subject}
            multiple={Boolean(multiple.subject)}
            required={required.subject}
            disabled={disabled.subject || loading.subject || !canUseStandardChild}
            onChange={handleSubjectChange}
            className={cn(
              selectClassName,
              multiple.subject ? "min-h-28 py-2" : "h-11"
            )}
          >
            {!multiple.subject && (
              <option value="">
                {loading.subject
                  ? "Loading subjects..."
                  : placeholders.subject || "Select Subject"}
              </option>
            )}

            {uniqueSubjects.map((subject) => (
              <option
                key={subject.subject_id}
                value={String(subject.subject_id)}
              >
                {subject.subject_name}
              </option>
            ))}
          </select>

          {errors.subject && (
            <p className="text-xs text-red-600">{errors.subject}</p>
          )}
        </div>
      )}
    </div>
  );
}
