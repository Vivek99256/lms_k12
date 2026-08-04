"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, Upload, Users } from "lucide-react";
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader } from "@/components/erp/erp-ui";
import { mapApiLinkToRoute } from "@/app/data/routeMapper";
import { JourneyRibbon } from "../_components/JourneyRibbon";
import { StepDrawer } from "../_components/StepDrawer";
import {
  OnboardingLegend,
  OnboardingPanel,
  ProgressMeter,
} from "../_components/onboarding-ui";
import {
  errorMessage,
  loadModuleJourney,
  updateOnboardingStep,
  type OnboardingJourney,
  type OnboardingStep,
  type StepUpdate,
} from "../_lib/onboarding-api";

/**
 * One module's onboarding journey, rendered as the serpentine ribbon from the
 * reference design with a step detail panel alongside.
 */
export default function ModuleOnboardingPage() {
  const params = useParams<{ module: string }>();
  const moduleKey = typeof params?.module === "string" ? params.module : "";

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

  const handleSave = useCallback(
    async (stepId: number, update: StepUpdate) => {
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
    },
    []
  );

  const selectedStep = useMemo(
    () => journey?.steps.find((step) => step.id === selectedId) ?? null,
    [journey, selectedId]
  );

  const selectedIndex = useMemo(
    () => (journey && selectedStep ? journey.steps.indexOf(selectedStep) + 1 : 0),
    [journey, selectedStep]
  );

  const masterMenus = useMemo(
    () => (journey?.resources.menus ?? []).filter((menu) => menu.menuType === "MASTER"),
    [journey]
  );

  const importTables = useMemo(
    () => Object.entries(journey?.resources.importFields ?? {}),
    [journey]
  );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Link
        href="/general/onboarding"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All modules
      </Link>

      <ErpPageHeader
        title={journey?.module.moduleName || "Module onboarding"}
        description={
          journey?.module.description ||
          "Follow the steps below to get this module ready for your institute."
        }
        onRefresh={() => void load(true)}
        refreshing={refreshing}
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

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="space-y-5">
              <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-5 font-semibold text-slate-900">Journey</h2>
                <div className="min-w-[36rem] sm:min-w-0">
                  <JourneyRibbon
                    steps={journey.steps}
                    selectedId={selectedId}
                    onSelect={(step) => setSelectedId(step.id)}
                  />
                </div>
              </section>

              {journey.resources.requirements ? (
                <OnboardingPanel
                  title="What we need from you"
                  description="Information the implementation team collects before this module goes live."
                >
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                    {journey.resources.requirements}
                  </p>
                </OnboardingPanel>
              ) : null}

              {journey.resources.responsibilities.length > 0 ? (
                <OnboardingPanel
                  title="Who is responsible"
                  description="Role responsibilities recorded for this module."
                >
                  <dl className="space-y-3">
                    {journey.resources.responsibilities.map((item) => (
                      <div key={item.profileName} className="flex gap-3">
                        <dt className="w-28 shrink-0 text-sm font-medium text-slate-700">
                          <Users className="mr-1 inline size-3.5 text-slate-400" aria-hidden />
                          {item.profileName}
                        </dt>
                        <dd className="text-sm text-slate-600">{item.text}</dd>
                      </div>
                    ))}
                  </dl>
                </OnboardingPanel>
              ) : null}

              {masterMenus.length > 0 ? (
                <OnboardingPanel
                  title="Setup screens"
                  description="The master screens this module depends on."
                >
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {masterMenus.map((menu) => {
                      const target = mapApiLinkToRoute(menu.link);
                      const usable = target && target !== "#";

                      return (
                        <li key={menu.id}>
                          {usable ? (
                            <Link
                              href={target}
                              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-violet-300 hover:bg-slate-50"
                            >
                              <span className="truncate">{menu.name}</span>
                              <ArrowUpRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                            </Link>
                          ) : (
                            <span className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400">
                              <span className="truncate">{menu.name}</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </OnboardingPanel>
              ) : null}

              {importTables.length > 0 ? (
                <OnboardingPanel
                  title="Bulk upload templates"
                  description="Columns expected when importing existing records for this module."
                >
                  <div className="space-y-4">
                    {importTables.map(([table, fields]) => (
                      <div key={table}>
                        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <Upload className="size-3.5 text-slate-400" aria-hidden />
                          <code className="font-mono text-xs">{table}</code>
                          <span className="text-xs font-normal text-slate-400">
                            {fields.length} columns
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {fields.slice(0, 24).map((field, index) => (
                            <span
                              key={`${table}-${index}`}
                              className={`rounded-md px-2 py-0.5 text-xs ${
                                field.is_required
                                  ? "bg-violet-50 text-violet-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {field.display_name || field.field_name}
                            </span>
                          ))}
                          {fields.length > 24 ? (
                            <span className="px-1 text-xs text-slate-400">
                              +{fields.length - 24} more
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/general/bulk_upload"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline"
                  >
                    <FileText className="size-4" aria-hidden />
                    Go to bulk upload
                  </Link>
                </OnboardingPanel>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-4 lg:self-start">
              {selectedStep ? (
                <StepDrawer
                  step={selectedStep}
                  stepNumber={selectedIndex}
                  saving={saving}
                  onClose={() => setSelectedId(null)}
                  onSave={handleSave}
                />
              ) : (
                <div className="hidden rounded-2xl border border-dashed border-slate-300 p-8 text-center lg:block">
                  <p className="font-medium text-slate-700">Select a step</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose any step in the journey to see what it needs, who owns it, and how it
                    is measured.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
