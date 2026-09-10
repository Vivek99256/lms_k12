/**
 * The products that share the AI & Intelligence capabilities.
 *
 * WHY THIS LIST IS HERE AND NOT IN THE APP
 *
 * This package is meant to be consumed by all three products, so it must not
 * import anything from `lms_k12`'s own `lib/` or `app/`. The ids below are
 * therefore declared here, and `lib/ai/ai-capabilities.test.ts` on the app side
 * asserts they match the adapters registered in `lib/ai/project-resolver.ts` —
 * the list the shared `/api/ai/*` endpoint actually serves. Two lists that must
 * agree, pinned by a test, rather than one list an unrelated product cannot
 * reach.
 *
 * KIND IS ABOUT TRUST, NOT IMPORTANCE
 *
 * `host` means the capability's implementation and its API routes live in that
 * codebase, and a caller's scope rides on the signed-in user's own bearer token.
 * `external` means the product calls in from another deployment and must present
 * a service token. LMS K-12 is the host today because that is simply where this
 * code was written first; nothing in the contract assumes it stays that way.
 */

export type SolutionId = 'lms_k12' | 'g2g' | 'enterprise_brain';

export type SolutionKind = 'host' | 'external';

export interface Solution {
  id: SolutionId;
  label: string;
  kind: SolutionKind;
  /** One sentence: what this product is, in terms of what it asks AI for. */
  description: string;
}

export const SOLUTIONS: readonly Solution[] = [
  {
    id: 'lms_k12',
    label: 'LMS K-12',
    kind: 'host',
    description:
      'The school ERP. Asks for curriculum, fees, admissions and teaching intelligence, and is where every capability below is implemented first.',
  },
  {
    id: 'g2g',
    label: 'G2G',
    kind: 'external',
    description:
      'Capability and competency workflows. Asks for role, skill and development-path intelligence over its own taxonomy.',
  },
  {
    id: 'enterprise_brain',
    label: 'Enterprise Brain',
    kind: 'external',
    description:
      'Institution intelligence and automation. Asks for signals, deliberation and agent execution over the whole organisation.',
  },
];

export const SOLUTION_IDS: readonly SolutionId[] = SOLUTIONS.map((solution) => solution.id);

export function getSolution(id: SolutionId): Solution | undefined {
  return SOLUTIONS.find((solution) => solution.id === id);
}

/** The header every cross-product call carries. Mirrors `PROJECT_ID_HEADER`. */
export const SOLUTION_ID_HEADER = 'x-project-id';
