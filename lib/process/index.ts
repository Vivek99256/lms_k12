/**
 * SOP -> Process / Workflow / Task conversion.
 *
 * Public surface for the `general/add_process` screens and the
 * `api/process/convert` route. Import from here, not from the files directly,
 * so the internal split stays free to move.
 */

export * from './types'
export * from './sop-catalog'
export * from './sop-source'
export * from './intake'
export * from './parser'
export * from './derive-tasks'
export * from './envelope'

import { deriveTasks } from './derive-tasks'
import { parseSopProcedure, type ParseOptions, type ParseResult } from './parser'
import type { SopModule } from './sop-catalog'
import type { TaskDraft } from './types'

/**
 * The whole conversion in one call: text in, process with its workflow and its
 * derived task drafts out. Parsing and derivation stay separable because the
 * review screen re-derives tasks after an edit, but every entry point that
 * wants "a finished process" should come through here.
 */
export function convertSopProcedure(
  text: string,
  module: SopModule,
  options: ParseOptions & { previousTasks?: TaskDraft[] } = {}
): ParseResult {
  const result = parseSopProcedure(text, module, options)
  if (!result.spec) return result

  return {
    ...result,
    spec: {
      ...result.spec,
      tasks: deriveTasks(result.spec, module, { previous: options.previousTasks }),
    },
  }
}
