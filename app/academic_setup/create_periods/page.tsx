import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function CreatePeriodsPage() {
  return <AcademicSetupPage config={{
    module: "periods",
    title: "Create periods",
    description: "Create timetable periods and attendance time windows.",
    singular: "Period",
    fields: [
      { key: "title", label: "Period title", kind: "text", required: true },
      { key: "short_name", label: "Short name", kind: "text", required: true },
      { key: "sort_order", label: "Sort order", kind: "number", required: true },
      { key: "academic_section_id", label: "Grade", kind: "select", source: "grades" },
      { key: "academic_year_id", label: "Academic year", kind: "select", source: "academicYears" },
      { key: "start_time", label: "Start time", kind: "time", required: true },
      { key: "end_time", label: "End time", kind: "time", required: true },
      { key: "used_for_attendance", label: "Used for attendance", kind: "checkbox" },
      { key: "standards", label: "Standards", kind: "multiselect", source: "standards" },
    ],
    columns: [
      { key: "title", label: "Period" },
      { key: "short_name", label: "Short name" },
      { key: "sort_order", label: "Sort order" },
      { key: "start_time", label: "Start time" },
      { key: "end_time", label: "End time" },
      { key: "used_for_attendance", label: "Attendance" },
    ],
  }} />;
}
