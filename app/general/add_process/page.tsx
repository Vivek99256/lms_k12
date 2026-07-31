import { BackendGapPage } from "../backend_gap_page";

export default function Page() {
  return (
    <BackendGapPage
      title="Add Process"
      description="Manage requirement gathering processes and add process workflows."
      laravelController="App\Http\Controllers\reuirementController"
      expectedEndpoint="CRUD /api/requirements"
    />
  );
}
