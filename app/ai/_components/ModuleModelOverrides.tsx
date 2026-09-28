'use client';

/**
 * "Per-module overrides" — the central console's window onto `ai_module_model_bindings`.
 *
 * WHY THIS SECTION EXISTS BESIDE `ModelManager`, NOT INSTEAD OF IT
 *
 * `ModelManager` above edits `ai_models`/`ai_api_keys` — the platform-wide default every
 * capability falls back to. This section edits a different, deliberately separate table:
 * a module's own override, the same row Fees → AI Stack → Models edits. The two must
 * stay separate rows (see `lib/intelligence/ai-module.ts`'s own note on why), so this is
 * additive rather than a rewrite of the table above.
 *
 * WHY THIS REUSES `AiStackModelsScreen` RATHER THAN WRITING A SECOND IMPLEMENTATION
 *
 * It is the exact component every module's own AI Stack → Models tab already renders,
 * already calling `fetchModuleModels`/`saveModuleModel`/`clearModuleModel` scoped to
 * whichever module key it is given. Selecting "Fees" here mounts the identical component
 * with `module={{key: 'fees', label: 'Fees'}}` — so what is shown and saved is the exact
 * row Fees' own AI Stack shows, live, with no redirect and no second code path to drift
 * from the first.
 */

import { useEffect, useState } from 'react';

import { AiStackModelsScreen } from '@/app/_components/ai-stack/models-screen';
import { fetchTemplateOptions, type TemplateModule } from '@/lib/intelligence/ai-templates';
import { ModulePicker } from './ModulePicker';

export function ModuleModelOverrides() {
  const [modules, setModules] = useState<TemplateModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchTemplateOptions()
      .then((options) => {
        if (cancelled) return;
        setModules(options.modules);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selected = modules.find((module) => module.key === moduleKey) ?? null;

  return (
    <section className="mt-10 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Per-module overrides</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What one module runs on when it has chosen to override the platform default above. Selecting a
            module here shows and edits the exact row that module&rsquo;s own AI Stack &rarr; Models tab does.
          </p>
        </div>
        <ModulePicker modules={modules} value={moduleKey} onChange={setModuleKey} allowAll={false} loading={loading} />
      </div>

      <div className="mt-4">
        {selected ? (
          <AiStackModelsScreen key={selected.key} module={{ key: selected.key, label: selected.label }} />
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {loading ? 'Loading modules…' : 'Select a module to view or override what it runs on.'}
          </div>
        )}
      </div>
    </section>
  );
}
