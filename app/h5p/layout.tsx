import type { ReactNode } from 'react';

import './h5p.css';

/**
 * The H5P segment layout. Its only job is to pull in `h5p.css` once, for every
 * route under /h5p.
 *
 * WHY HERE AND NOT IN globals.css. The stylesheet is ~400 lines that only the
 * activity players use; importing it from the root layout would put it in the
 * critical path of the fees screen, the timetable and everything else. Next.js
 * hoists a segment-level CSS import into the same stylesheet bundle for this
 * route only, which is exactly the boundary we want.
 *
 * WHY NOT IMPORT IT FROM EACH PLAYER. Fourteen imports of the same file is one
 * import in the output, so it would work -- but a new player is then one
 * forgotten line away from rendering unstyled, and the failure looks like a
 * broken activity rather than a missing import. (This import only reaches
 * the standalone `/h5p/...` routes. A caller that embeds these players from
 * outside this segment -- PAL, homework, the question bank quiz, all via
 * `components/h5p/players/` -- gets the stylesheet from the single import in
 * `components/h5p/players/shared.tsx` instead, which every player there
 * imports.)
 *
 * This is a server component and holds no state, so it adds nothing to the
 * client bundle.
 */
export default function H5pLayout({ children }: { children: ReactNode }) {
  return children;
}
