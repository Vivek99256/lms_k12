/**
 * The module registry - every module whose SOP this feature can convert.
 *
 * One list, in one place. The Module dropdown on the converter is this array
 * rendered; the Process group and Procedure dropdowns are the selected entry's
 * `groups` and their `procedures`. So a module becomes available on every
 * screen, and to the AI conversion route, by being listed here and nowhere
 * else - there is no second place a module has to be registered, and no screen
 * that keeps its own copy of the list.
 *
 * The registry lives apart from `sop-catalog.ts` so a module catalogue can
 * import the shared shape and the `procedureIndex` helper without importing the
 * list that contains it.
 */

import { FEES_MODULE } from './fees-catalog'
import { LMS_PAL_MODULE, vocabularyFor, type ModuleVocabulary, type SopModule } from './sop-catalog'

/**
 * Registered modules, in the order the Module dropdown offers them.
 *
 * LMS + PAL stays first: it is the default for `/general/add_process`, which
 * has always opened on it. A screen that belongs to one module (Fees →
 * Process builder) names its own default instead of relying on this order.
 */
export const SOP_MODULES: SopModule[] = [LMS_PAL_MODULE, FEES_MODULE]

export function findModule(key: string): SopModule | undefined {
  return SOP_MODULES.find((module) => module.key === key)
}

/**
 * A module that has no SOP catalogue yet, so the converter can still be used
 * from it.
 *
 * WHY THIS EXISTS. Every module in the ERP now has a Process Builder tab, and
 * two of them ship a digitized SOP. Before this, opening the converter from
 * Student showed a Module dropdown offering LMS + PAL and Fees and defaulted to
 * the first — so the screen silently claimed to be somewhere the person was
 * not, and saving would have filed the process under the wrong module.
 *
 * An entry built here carries the module's identity and nothing else: no
 * groups, no rules, no records register. That is not a stub standing in for
 * content someone will write; it is the accurate statement that this module's
 * SOP has not been digitized. The converter is built for it — an unknown
 * procedure number and an uncited rule are WARNINGS in the parser, not errors —
 * so pasting a procedure, converting it and saving it all work, and the only
 * thing missing is the lifecycle stage and rule check the index would have
 * added.
 *
 * The three SOP fields are left empty rather than invented. They are copied
 * onto the saved process as its provenance, and a made-up document name and
 * version would be a lie told about every process saved from this module.
 *
 * A module that later authors its SOP is added to SOP_MODULES in the normal
 * way, and the entry here stops being reachable for it — the lookup in
 * AddProcessPage prefers a registered module of the same key.
 */
export function bareModule(key: string, name: string): SopModule {
  return {
    key,
    name,
    sop: { document: '', version: '', organization: '', effectiveDate: '' },
    lifecycleStages: [],
    groups: [],
    businessRules: [],
    records: [],
  }
}

/**
 * Resolve a module from the display name stored on a `ProcessSpec`.
 *
 * A saved process records `module` as the name ('Fees'), not the key, because
 * that is what the storage envelope and the saved-process table show. Reopening
 * one has to find its module again - to resolve its procedure and to speak its
 * vocabulary - and with more than one module registered, guessing wrong means
 * reading a Fees process in LMS words.
 */
export function findModuleByName(name: string): SopModule | undefined {
  const wanted = name.trim().toLowerCase()
  return SOP_MODULES.find((module) => module.name.toLowerCase() === wanted)
}

/**
 * The vocabulary of the module a spec belongs to, resolved by name.
 *
 * For display components, which hold a `ProcessSpec` rather than a `SopModule`.
 * An unknown name falls back to the default wording rather than failing - a
 * process saved before a module was renamed still renders.
 */
export function vocabularyForModuleName(name: string | undefined): ModuleVocabulary {
  const sopModule = name ? findModuleByName(name) : undefined
  return vocabularyFor(sopModule ?? {})
}

/**
 * The procedure a module ships full SOP text for, offered as its sample.
 *
 * Each module authors one procedure in full and writes the rest against it, so
 * "try the sample" means "the first digitized procedure of the module you are
 * on" - not a hard-coded reference that only exists in one module.
 */
export function sampleProcedureFor(
  moduleKey: string
): { moduleKey: string; groupRef: string; procedureRef: string; title: string } | null {
  const sopModule = findModule(moduleKey)
  if (!sopModule) return null

  for (const group of sopModule.groups) {
    const procedure = group.procedures.find((entry) => entry.digitized)
    if (procedure) {
      return {
        moduleKey: sopModule.key,
        groupRef: group.ref,
        procedureRef: procedure.ref,
        title: procedure.title,
      }
    }
  }

  return null
}
