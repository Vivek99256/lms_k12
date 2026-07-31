import { BackendGapPage } from "../backend_gap_page";

export default function Page() {
  return (
    <BackendGapPage
      title="Group-wise Rights"
      description="Assign view, add, edit, and delete rights to user profiles."
      laravelController="App\Http\Controllers\user\tblgroupwise_rightsController"
      expectedEndpoint="CRUD /api/groupwise-rights"
    />
  );
}
