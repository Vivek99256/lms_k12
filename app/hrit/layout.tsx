import type { ReactNode } from 'react';
import '@/g2g/globals.css';

/**
 * Applies g2g/globals.css (the untouched, exact copy of G2G's own stylesheet)
 * to every page under app/hrit/** only. Next.js scopes a nested layout's CSS
 * import to that layout's route subtree at the asset-loading level (verified:
 * this file's compiled CSS chunk is only linked on /hrit/** pages, never on
 * the rest of the app), so app/globals.css and this file never load on the
 * same page outside of /hrit/** - no need to rescope selectors by hand.
 */
export default function HritLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
