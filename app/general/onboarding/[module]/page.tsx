"use client";

import { useParams } from "next/navigation";
import { ModuleJourney } from "../_components/ModuleJourney";

/**
 * One module's onboarding journey, reached from the module index. The screen
 * itself lives in ModuleJourney, which Fees → Onboarding renders too.
 */
export default function ModuleOnboardingPage() {
  const params = useParams<{ module: string }>();
  const moduleKey = typeof params?.module === "string" ? params.module : "";

  return (
    <div className="p-4 sm:p-6">
      <ModuleJourney moduleKey={moduleKey} backHref="/general/onboarding" />
    </div>
  );
}
