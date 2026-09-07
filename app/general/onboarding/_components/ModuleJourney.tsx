"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader } from "@/components/erp/erp-ui";
import { JourneyRibbon } from "./JourneyRibbon";
import { StepDrawer } from "./StepDrawer";
import { OnboardingLegend, OnboardingPanel, ProgressMeter } from "./onboarding-ui";
import {
  errorMessage,
  loadModuleJourney,
  updateOnboardingStep,
  type OnboardingJourney,
  type StepUpdate,
} from "../_lib/onboarding-api";

/**
 * One module's onboarding journey — the serpentine ribbon from the reference
 * design with a step detail drawer alongside.
 *
 * Lives here rather than in the /general/onboarding/[module] page because more
 * than one route shows the same journey: the module page reached from the
 * onboarding index, and Fees → Onboarding, which shows the Fees journey inside
 * the Fees category nav instead of a placeholder. Both render this component so
 * there is one implementation of the screen.
 *
 * `backHref` is optional: the module page links back to the module index, while
 * a module's own onboarding tab already sits inside that module's navigation
 * and has nothing to go back to.
 */
export function ModuleJourney({
  moduleKey,
  backHref,
}: {
  moduleKey: string;
  backHref?: string;
}) {
  const [journey, setJourney] = useState<OnboardingJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!moduleKey) return;

      isRefresh ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const next = await loadModuleJourney(moduleKey);
        setJourney(next);
        // Keep the drawer pointed at a step that still exists after a refresh.
        setSelectedId((current) =>
          current && next.steps.some((step) => step.id === current) ? current : null
        );
      } catch (caught) {
        setError(errorMessage(caught, "Could not load this module's onboarding journey."));
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [moduleKey]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async (stepId: number, update: StepUpdate) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await updateOnboardingStep(stepId, update);
      setJourney((current) =>
        current
          ? {
            ...current,
            steps: current.steps.map((step) => (step.id === stepId ? result.step : step)),
            summary: result.summary,
          }
          : current
      );
      setNotice("Step updated.");
    } catch (caught) {
      setError(errorMessage(caught, "Could not update this step."));
    } finally {
      setSaving(false);
    }
  }, []);

  const selectedStep = useMemo(
    () => journey?.steps.find((step) => step.id === selectedId) ?? null,
    [journey, selectedId]
  );

  const selectedIndex = useMemo(
    () => (journey && selectedStep ? journey.steps.indexOf(selectedStep) + 1 : 0),
    [journey, selectedStep]
  );

  return (
    <div className="space-y-5">
      <ErpPageHeader
        title={journey?.module.moduleName || "Module onboarding"}
        description={
          journey?.module.description ||
          "Follow the steps below to get this module ready for your institute."
        }
        onRefresh={() => void load(true)}
        refreshing={refreshing}
        // `actions` renders immediately before the Refresh button, so Back sits
        // alongside it rather than floating above the title.
        actions={
          backHref ? (
            /* A real <Link> rather than router.back() so it always lands on the
               module index — the journey is often reached directly by URL, where
               browser history would go somewhere else — and so middle-click and
               open-in-new-tab keep working. */
            <Link
              href={backHref}
              aria-label="Back to all modules"
              className={buttonVariants({
                variant: "outline",
                className: "group gap-1.5",
              })}
            >
              {/* The arrow eases left on hover — the same nudge the module cards
                  already use, gated on motion-safe so it collapses to nothing for
                  users who ask for reduced motion. */}
              <ArrowLeft
                className="size-4 transition-transform duration-200 ease-out motion-safe:group-hover:-translate-x-0.5"
                aria-hidden
              />
              Back
            </Link>
          ) : null
        }
      />

      {error ? <ErpAlert tone="error">{error}</ErpAlert> : null}
      {notice ? <ErpAlert tone="success">{notice}</ErpAlert> : null}

      {loading ? (
        <ErpLoading label="Loading journey…" />
      ) : !journey ? (
        <ErpEmpty
          title="Journey not available"
          hint="This module has no onboarding journey configured for your institute."
        />
      ) : (
        <>
          <OnboardingPanel
            title="Progress"
            description={`${journey.summary.requiredCompleted} of ${journey.summary.requiredSteps} required steps complete`}
          >
            <ProgressMeter percent={journey.summary.percentComplete} label="Module completion" />
            <div className="mt-4 border-t border-slate-100 pt-4">
              <OnboardingLegend />
            </div>
          </OnboardingPanel>

          {/* The ribbon runs the full width of the page, as in the reference
              design; step details open in an overlay drawer rather than taking
              a column away from it. */}
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="mb-6 font-semibold text-slate-900">Journey</h2>
            <div className="min-w-[44rem] sm:min-w-0">
              <JourneyRibbon
                steps={journey.steps}
                selectedId={selectedId}
                currentUserName={journey.context.currentUserName}
                onSelect={(step) => setSelectedId(step.id)}
              />
            </div>
          </section>

          <StepDrawer
            step={selectedStep}
            stepNumber={selectedIndex}
            saving={saving}
            users={journey.resources.users}
            currentUserName={journey.context.currentUserName}
            onClose={() => setSelectedId(null)}
            onSave={handleSave}
          />
        </>
      )}
    </div>
  );
}
