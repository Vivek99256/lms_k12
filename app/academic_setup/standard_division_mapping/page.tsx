import { AcademicSetupPage } from "../_components/AcademicSetupPage";

export default function StandardDivisionMappingPage() {
  return <AcademicSetupPage config={{
    module: "standard-division-mapping",
    title: "Standard Division Mapping",
    description: "Map the divisions available for each standard.",
    singular: "Mapping",
    fields: [],
    columns: [],
    mapping: true,
  }} />;
}
