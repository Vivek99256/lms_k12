import {
  BedDouble,
  Briefcase,
  Bus,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  Library,
  ReceiptIndianRupee,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Where "Go live" lands once a module's onboarding journey is complete.
 *
 * The onboarding API describes a module's journey but not where the module
 * actually lives in this app, so the destination is resolved here against the
 * routes that exist under `app/`. Every entry below was checked against a real
 * `page.tsx`; anything unmapped falls back to the institute dashboard rather
 * than guessing a URL that would 404 at the end of a celebration.
 *
 * Keys are matched case-insensitively with `-`/`_`/space folded away, so a
 * backend that says `talent_management`, `Talent Management` or `talent` all
 * resolve to the same route.
 */
export type ModuleLaunchTarget = {
  /** Route pushed once the launch animation finishes. */
  route: string;
  /** Module mark that glows on the success card. */
  icon: LucideIcon;
  /** True when the module has no dashboard of its own and we land on the general one. */
  isFallback: boolean;
};

const FALLBACK_ROUTE = "/dashboard";

const ROUTES: Record<string, { route: string; icon: LucideIcon }> = {
  fees: { route: "/fees/dashboard", icon: ReceiptIndianRupee },
  lms: { route: "/lms/dashboard", icon: GraduationCap },
  admissions: { route: "/admissions/dashboard", icon: UserPlus },
  admission: { route: "/admissions/dashboard", icon: UserPlus },
  students: { route: "/students/dashboard", icon: Users },
  student: { route: "/students/dashboard", icon: Users },
  library: { route: "/library/dashboard", icon: Library },
  hostel: { route: "/hostel/dashboard", icon: BedDouble },
  transportation: { route: "/Transportation/dashboard", icon: Bus },
  transport: { route: "/Transportation/dashboard", icon: Bus },
  attendance: { route: "/attendance/attendance_dashboard", icon: CalendarCheck },
  talent: { route: "/talent-management/talent-dashboard", icon: Briefcase },
  talentmanagement: { route: "/talent-management/talent-dashboard", icon: Briefcase },
  competency: { route: "/people-competency/lms/learning-dashboard", icon: Target },
  peoplecompetency: { route: "/people-competency/lms/learning-dashboard", icon: Target },
};

function normalise(moduleKey: string): string {
  return moduleKey.toLowerCase().replace(/[\s_-]+/g, "");
}

export function resolveModuleLaunch(moduleKey: string): ModuleLaunchTarget {
  const match = ROUTES[normalise(moduleKey)];

  return match
    ? { ...match, isFallback: false }
    : { route: FALLBACK_ROUTE, icon: LayoutDashboard, isFallback: true };
}
