import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function CreateBatchPage() {
  return <AcademicSetupPage config={{
    module: "batches",
    title: "Create Batch",
    description: "Create academic-year batches for mapped standards and divisions.",
    singular: "Batch",
    fields: [
      { key: "standard_id", label: "Standard", kind: "select", source: "standards", required: true },
      { key: "division_id", label: "Division", kind: "select", source: "divisions", dependsOn: "standard_id", required: true },
      { key: "title", label: "Batch Name", kind: "text", required: true },
    ],
    columns: [
      { key: "standard_name", label: "Standard" },
      { key: "division_name", label: "Division" },
      { key: "titles", label: "Batches" },
    ],
  }} />;
}
