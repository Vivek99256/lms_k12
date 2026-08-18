/**
 * New PAL → Gamification.
 *
 * A layout rather than a repeated header: every page under this route gets the
 * same shell, and the New PAL sub-nav above it is already rendered by
 * DashboardShell for all `/pal*` routes.
 */
export const metadata = {
  title: 'Gamification — New PAL',
  description:
    'PAL V4 Personal Best, badges, streaks, team challenges, Career Quest and opt-in Challenge Mode.',
};

export default function GamificationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
