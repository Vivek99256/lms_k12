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
