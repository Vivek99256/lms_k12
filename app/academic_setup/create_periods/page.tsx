import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function CreatePeriodsPage() {
  return <AcademicSetupPage config={{
    module: "periods",
    title: "Create Periods",
    description: "Create timetable periods and attendance time windows.",
    singular: "Period",
    fields: [
      { key: "title", label: "Period Title", kind: "text", required: true },
      { key: "short_name", label: "Short Name", kind: "text", required: true },
      { key: "sort_order", label: "Sort Order", kind: "number", required: true },
      { key: "academic_section_id", label: "Grade", kind: "select", source: "grades" },
      { key: "academic_year_id", label: "Academic Year", kind: "select", source: "academicYears" },
      { key: "start_time", label: "Start Time", kind: "time", required: true },
      { key: "end_time", label: "End Time", kind: "time", required: true },
      { key: "used_for_attendance", label: "Used for Attendance", kind: "checkbox" },
      { key: "standards", label: "Standards", kind: "multiselect", source: "standards" },
    ],
    columns: [
      { key: "title", label: "Period" },
      { key: "short_name", label: "Short Name" },
      { key: "sort_order", label: "Sort Order" },
      { key: "start_time", label: "Start Time" },
      { key: "end_time", label: "End Time" },
      { key: "used_for_attendance", label: "Attendance" },
    ],
  }} />;
}
