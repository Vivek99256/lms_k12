/**
 * Grade → standard → division options are shared with the Admin services
 * menus, so the loader now lives in `@/lib/class-options`.
 */
export {
  divisionsForStandard,
  emptyClassOptions,
  loadClassOptions,
  standardsForGrade,
} from "@/lib/class-options";

export type {
  ClassOptions,
  DivisionOption,
  NamedOption,
  StandardOption,
} from "@/lib/class-options";
