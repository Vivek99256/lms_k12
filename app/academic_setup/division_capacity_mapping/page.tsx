import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function DivisionCapacityMappingPage() {
  return <AcademicSetupPage config={{
    module: "division-capacities",
    title: "Division Capacity Mapping",
    description: "Set the student capacity for each grade, standard, and division.",
    singular: "Division Capacity",
    fields: [
      { key: "grade_id", label: "Grade", kind: "select", source: "grades", required: true },
      { key: "standard_id", label: "Standard", kind: "select", source: "standards", dependsOn: "grade_id", required: true },
      { key: "division_id", label: "Division", kind: "select", source: "divisions", dependsOn: "standard_id", required: true },
      { key: "capacity", label: "Capacity", kind: "number", required: true },
    ],
    columns: [
      { key: "academic_section_name", label: "Grade" },
      { key: "standard_name", label: "Standard" },
      { key: "division_name", label: "Division" },
      { key: "capacity", label: "Capacity" },
    ],
  }} />;
}
