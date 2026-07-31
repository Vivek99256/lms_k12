import { BackendGapPage } from "../backend_gap_page";

export default function Page() {
  return (
    <BackendGapPage
      title="Mobile App Rights"
      description="Configure mobile app home screen rights and visibility per profile."
      laravelController="App\Http\Controllers\user\tblmobileAppMenuRightsController"
      expectedEndpoint="CRUD /api/mobile-app-rights"
    />
  );
}
