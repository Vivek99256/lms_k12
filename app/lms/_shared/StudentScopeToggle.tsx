"use client";

/**
 * Who a homework or assignment is being created for: the students the teacher
 * ticks off one by one, or every student in the chosen class.
 *
 * "Student wise" is the default and is the behaviour both screens have always
 * had — the class search loads a table of students with checkboxes. "All
 * students" skips the table entirely: the backend resolves the roster from the
 * selected section, standard and division at assign time, so nothing is picked
 * by hand and nothing is sent from the browser.
 *
 * Shared by app/lms/homework (Student Homework) and app/lms/lmsAssignment
 * (Assignment), which ask the same question of the teacher and must answer it
 * the same way.
 *
 * Native radios in a `radiogroup`, so arrow-key navigation, focus and the
 * accessible name come for free — the same pattern the homework screen's
 * source picker already uses.
 */

export type StudentScope = "student_wise" | "all_students";

const OPTIONS: Array<{ value: StudentScope; label: string; hint: string }> = [
  {
    value: "student_wise",
    label: "Student wise",
    hint: "Search the class, then pick the students individually.",
  },
  {
    value: "all_students",
    label: "All students",
    hint: "Assign to every student in the selected section, standard and division.",
  },
];

export function StudentScopeToggle({
  value,
  onChange,
  disabled = false,
  name = "student-scope",
}: {
  value: StudentScope;
  onChange: (value: StudentScope) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <div className="space-y-2">
      <p id={`${name}-label`} className="text-sm font-medium text-slate-700">
        Assign to
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${name}-label`}
        className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
      >
        {OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium transition focus-within:ring-2 focus-within:ring-blue-100 ${
                isSelected
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">
        {OPTIONS.find((option) => option.value === value)?.hint}
      </p>
    </div>
  );
}

export default StudentScopeToggle;
