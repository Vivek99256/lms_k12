'use client';

import { HelpGuideGrid } from '@/app/fees/help-guide-support/_components/help-guide-grid';

/**
 * Fees → Help Guide / Support.
 *
 * Opens a clean Grid/Thumbnail view of support content loaded dynamically from
 * tblmenumaster. All tab navigation is hidden — the page renders only the grid
 * of cards, each with an icon, title and short description. Clicking a card
 * opens the configured PDF / video / document link in a new tab.
 */
export default function Page() {
  return <HelpGuideGrid />;
}
