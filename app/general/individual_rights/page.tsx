import { BackendGapPage } from "../backend_gap_page";

export default function Page() {
  return (
    <BackendGapPage
      title="Individual Rights"
      description="Assign view, add, edit, and delete rights to individual users."
      laravelController="App\Http\Controllers\user\tblindividual_rightsController"
      expectedEndpoint="CRUD /api/individual-rights"
    />
  );
}
