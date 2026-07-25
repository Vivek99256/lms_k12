import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Database,
  Receipt,
  Repeat2,
  SlidersHorizontal,
} from "lucide-react";
import { ROUTES } from "@/app/lib/routes";

const UTILITIES = [
  {
    href: ROUTES.utility.studentTransfer,
    title: "Student transfer",
    description:
      "Move students to another institute of the same client, carrying the selected record groups with them.",
    Icon: Building2,
  },
  {
    href: ROUTES.utility.rollover,
    title: "Rollover",
    description:
      "Copy master data and student enrolments from the current academic year into the next one.",
    Icon: Repeat2,
  },
  {
    href: ROUTES.utility.breakoffRollover,
    title: "Breakoff rollover",
    description:
      "Carry the fee breakoff into the next year, or clear a fee month in the current year.",
    Icon: Receipt,
  },
  {
    href: ROUTES.utility.updateAllData,
    title: "Update all data",
    description:
      "Bulk student activation, fee breakoff cleanup, roll number renumbering and leave rollover.",
    Icon: SlidersHorizontal,
  },
  {
    href: ROUTES.utility.customModule,
    title: "Custom module",
    description:
      "Design institute-specific tables, their columns and their menu entry without a release.",
    Icon: Database,
  },
  {
    href: ROUTES.utility.transferStudent,
    title: "Transfer student",
    description:
      "Promote students into the next academic year using each standard's mapped next standard.",
    Icon: ArrowUpRight,
  },
];

export default function UtilityIndexPage() {
  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Utility</h1>
        <p className="mt-1 text-sm text-slate-500">
          Year-end and maintenance tools. Every action here applies to many records at once.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {UTILITIES.map(({ href, title, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="mb-3 inline-flex rounded-xl bg-blue-50 p-2 text-blue-600">
              <Icon className="size-5" />
            </div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
