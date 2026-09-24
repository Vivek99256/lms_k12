'use client';

/**
 * Attendance → AI Stack → Models.
 *
 * WHAT THIS TAB IS, AND WHAT IT DELIBERATELY IS NOT
 *
 * It is a read-only window onto the central Model Management console. It is NOT a second
 * place to configure a model.
 *
 * Providers, models, credentials and quotas are estate-wide settings with one console
 * already — AI & Intelligence → Providers and → Models — writing to `ai_api_keys` and
 * `ai_models`. A per-module editor over those same rows is not configurability, it is two
 * places to look when the answer disagrees, and a per-module binding invites a school to
 * run Attendance on a model nobody else is using without meaning to. The Fees AI Stack
 * reached the same conclusion and dropped its Models tab entirely.
 *
 * This one exists because the question it answers is real and has no other home: an
 * administrator standing in Attendance wants to know which model an attendance answer
 * came from, whether a credential is actually bound, and where to go to change it. So it
 * shows, links, and never saves. Every write button lives on `/ai/models` and
 * `/ai/providers`, which is where this sends you.
 *
 * WHERE THE FIGURES COME FROM
 *
 * `fetchAiConfigurations()` — the same call the central console makes — returns a
 * `resolved` row per module saying what that module resolves to *right now* and through
 * which rule. Nothing here re-derives that: a module with no binding of its own falls
 * through to the shared pool and the row says so, which is the honest answer and the one
 * a school usually wants to hear.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Cpu, ExternalLink, KeyRound, TriangleAlert } from 'lucide-react';

import {
  fetchAiConfigurations,
  fetchAiModels,
  type AiConfigurationIndex,
  type AiModelIndex,
  type AiModelOption,
  type AiResolvedRow,
} from '@/lib/intelligence/ai-configuration';
import { fetchModuleUsage, type AiModuleUsage } from '@/lib/intelligence/ai-module';
import { ATTENDANCE_MODULE } from '@/lib/attendance/attendance-ai-stack';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
} from './attendance-ai-chrome';

/** How a module came by its provider, in words rather than in the enum's. */
const SOURCE_LABELS: Record<AiResolvedRow['source'], string> = {
  module: 'A credential bound to Attendance for this school',
  module_platform: 'A credential bound to Attendance for the whole estate',
  pool: "This school's shared credential, used by every module without its own",
  pool_platform: 'The estate-wide shared credential',
  env: 'The deployment environment, with no credential row behind it',
  config: 'A configuration file default',
};

export function AttendanceModelsScreen() {
  const [index, setIndex] = useState<AiConfigurationIndex | null>(null);
  const [catalogue, setCatalogue] = useState<AiModelIndex | null>(null);
  const [usage, setUsage] = useState<AiModuleUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Settled, not all: three different endpoints, and one being unreachable must not
    // cost the reader the other two. The catalogue in particular is a nicety.
    Promise.allSettled([fetchAiConfigurations(), fetchAiModels(), fetchModuleUsage(ATTENDANCE_MODULE)])
      .then(([configurations, models, moduleUsage]) => {
        if (cancelled) return;

        setIndex(configurations.status === 'fulfilled' ? configurations.value : null);
        setCatalogue(models.status === 'fulfilled' ? models.value : null);
        setUsage(moduleUsage.status === 'fulfilled' ? moduleUsage.value : null);

        setError(
          configurations.status === 'rejected'
            ? configurations.reason instanceof Error
              ? configurations.reason.message
              : 'The AI configuration could not be read.'
            : '',
        );
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('The AI configuration could not be read.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const resolved = useMemo(
    () => (index?.resolved ?? []).find((row) => row.module === ATTENDANCE_MODULE) ?? null,
    [index],
  );

  /** The models the resolved provider actually offers, from the central catalogue. */
  const providerModels = useMemo<AiModelOption[]>(() => {
    if (!resolved || !catalogue) return [];
    return (catalogue.models[resolved.provider] ?? []).filter((model) => model.status === 1);
  }, [resolved, catalogue]);

  const provider = usage?.provider;

  if (loading && !index) {
    return <AiStackLoading label="Loading the model Attendance resolves to…" />;
  }

  return (
    <section className="space-y-5">
      <AiStackHeader
        icon={Cpu}
        title="Models for Attendance"
        summary="Which model an Attendance answer is generated by, and through which rule. Read-only — models and credentials are managed centrally."
        loading={loading}
        onRefresh={reload}
        actions={
          <Link
            href="/ai/models"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white hover:opacity-95"
          >
            <ExternalLink className="size-4" />
            Manage models
          </Link>
        }
      />

      <AiStackHint>
        There is no Attendance-specific model configuration, on purpose. Attendance resolves its provider and model
        through the same central catalogue every other module uses, so a change made in{' '}
        <strong>AI &amp; Intelligence → Models</strong> reaches it immediately and there is never a second answer to
        which model a school is running.
      </AiStackHint>

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      {!resolved && !loading && !error && (
        <AiStackError>
          The configuration console returned no row for <span className="font-mono">attendance</span>. That usually
          means the module is not registered in <span className="font-mono">ai_modules</span> on this estate.
        </AiStackError>
      )}

      {resolved && (
        <>
          <AiStackMetrics
            metrics={[
              { key: 'provider', label: 'Provider', value: resolved.provider_label || resolved.provider },
              { key: 'model', label: 'Model', value: resolved.model ?? 'provider default', hint: 'What a generation runs on.' },
              {
                key: 'credential',
                label: 'Credential',
                value: resolved.has_key ? 'bound' : 'none',
                hint: resolved.has_key ? undefined : 'Requests fall back to the environment.',
              },
              {
                key: 'driveable',
                label: 'Client',
                value: resolved.driveable ? 'available' : 'missing',
                hint: resolved.driveable ? undefined : 'No client can call this provider yet.',
              },
              {
                key: 'limit',
                label: 'Daily limit',
                // Blank rather than invented. A quota nobody set is not "unlimited", it
                // is unknown, and printing a number here would be a claim about a plan.
                value:
                  provider && provider.available && provider.daily_limit !== null
                    ? provider.daily_limit
                    : 'not set',
                hint: provider && provider.available && provider.bound ? 'From the bound credential.' : undefined,
              },
            ]}
          />

          <AiStackCard>
            <AiStackCardHeading
              title="How Attendance resolves it"
              hint="The rule that chose this provider, as the backend reports it."
            />
            <div className="space-y-3 p-5 text-sm text-slate-700">
              <p className="flex flex-wrap items-center gap-2">
                <AiStackPill tone={resolved.wired ? 'green' : 'amber'}>
                  {resolved.wired ? 'wired' : 'not wired'}
                </AiStackPill>
                <span>{SOURCE_LABELS[resolved.source] ?? resolved.source}</span>
                <span className="font-mono text-xs text-slate-500">scope: {resolved.scope}</span>
              </p>

              {!resolved.wired && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Attendance has no credential of its own, so it uses whatever the shared pool resolves to. That is a
                    normal and usually correct state — bind one from{' '}
                    <Link href="/ai/providers" className="font-medium underline">
                      AI &amp; Intelligence → Providers
                    </Link>{' '}
                    only if attendance work should run on a different account.
                  </span>
                </p>
              )}

              {resolved.description && <p className="text-xs leading-5 text-slate-500">{resolved.description}</p>}
            </div>
          </AiStackCard>

          <AiStackCard className="overflow-hidden">
            <AiStackCardHeading
              title={`Models available on ${resolved.provider_label || resolved.provider}`}
              hint="From the central catalogue. Changing which one Attendance uses is a change to the credential, made centrally."
              actions={
                <Link
                  href="/ai/models"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
                >
                  <KeyRound className="size-3.5" />
                  Open Model Management
                </Link>
              }
            />

            {providerModels.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                The catalogue lists no active model for this provider. Add one in Model Management.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                  <AiStackTableHead columns={['Model', 'Max output', 'Input / 1k', 'Output / 1k', 'Scope', 'In use']} />
                  <tbody className="divide-y divide-slate-200">
                    {providerModels.map((model) => (
                      <tr key={model.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{model.label}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{model.model_id}</div>
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                          {model.max_output_tokens === null ? '—' : model.max_output_tokens.toLocaleString('en-IN')}
                        </td>
                        {/* A price nobody published is blank, never zero: "free" and
                            "unknown" are different claims and only one of them is safe. */}
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                          {model.input_cost_per_1k === null ? '—' : model.input_cost_per_1k}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                          {model.output_cost_per_1k === null ? '—' : model.output_cost_per_1k}
                        </td>
                        <td className="px-4 py-3">
                          <AiStackPill tone={model.scope === 'platform' ? 'blue' : 'gray'}>{model.scope}</AiStackPill>
                        </td>
                        <td className="px-4 py-3">
                          {model.model_id === resolved.model ? (
                            <AiStackPill tone="green">Attendance uses this</AiStackPill>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AiStackCard>
        </>
      )}
    </section>
  );
}
