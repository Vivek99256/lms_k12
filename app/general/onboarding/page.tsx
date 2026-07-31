import { BackendGapPage } from "../backend_gap_page";

export default function Page() {
  return (
    <BackendGapPage
      title="Onboarding"
      description="Institute onboarding wizard and setup checklist."
      laravelController="App\Http\Controllers\tourController@Onboarding"
      expectedEndpoint="GET /api/onboarding"
    />
  );
}
