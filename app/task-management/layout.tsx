import type { ReactNode } from 'react';
import '@/g2g/globals.css';

/**
 * Applies g2g/globals.css (the untouched, exact copy of G2G's own stylesheet)
 * to every page under app/task-management/** only, mirroring
 * app/talent-management/layout.tsx (and app/hrit/layout.tsx). Next.js scopes
 * a nested layout's CSS import to that layout's route subtree at the
 * asset-loading level, so app/globals.css and this file never load on the
 * same page outside of /task-management/**.
 */
export default function TaskManagementLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
