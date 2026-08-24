import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  ConciergeBell,
  FileSignature,
  MessageSquareWarning,
  Tags,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { ROUTES } from "@/app/lib/routes";

const GROUPS = [
  {
    title: "Visitor management",
    items: [
      {
        href: ROUTES.adminServices.addVisitor,
        title: "Add visitor",
        description: "Check visitors in and out and keep today's gate register.",
        Icon: UserPlus,
      },
      {
        href: ROUTES.adminServices.visitorReport,
        title: "Visitor report",
        description: "Every gate visit in a date range, with check-in and check-out times.",
        Icon: Users,
      },
    ],
  },
  {
    title: "Complaints",
    items: [
      {
        href: ROUTES.adminServices.complaintManagement,
        title: "Complaint management",
        description: "Raise complaints and track how they were resolved.",
        Icon: MessageSquareWarning,
      },
      {
        href: ROUTES.adminServices.complaintReport,
        title: "Complaint report",
        description: "Complaints raised in a date range, with their solution state.",
        Icon: ClipboardList,
      },
    ],
  },
  {
    title: "Consent",
    items: [
      {
        href: ROUTES.adminServices.consentMaster,
        title: "Consent master",
        description: "Issue a consent to every selected student of a class.",
        Icon: FileSignature,
      },
      {
        href: ROUTES.adminServices.deleteConsentMaster,
        title: "Delete consent master",
        description: "Find issued consents and remove the ones no longer needed.",
        Icon: Trash2,
      },
      {
        href: ROUTES.adminServices.consentReport,
        title: "Consent report",
        description: "Read-only view of every consent and the parent's response.",
        Icon: FileSignature,
      },
    ],
  },
  {
    title: "Front desk",
    items: [
      {
        href: ROUTES.adminServices.frontDesk,
        title: "Front desk",
        description: "Log who came in, who they met and why.",
        Icon: ConciergeBell,
      },
      {
        href: ROUTES.adminServices.frontDeskReport,
        title: "Front desk report",
        description: "Front desk visits for the year, filtered by date.",
        Icon: ConciergeBell,
      },
    ],
  },
  {
    title: "Petty cash",
    items: [
      {
        href: ROUTES.adminServices.pettyCash,
        title: "Petty cash",
        description: "Record day-to-day cash expenses against a head.",
        Icon: Wallet,
      },
      {
        href: ROUTES.adminServices.pettyCashMaster,
        title: "Petty cash master",
        description: "The expense heads petty cash entries are booked against.",
        Icon: Tags,
      },
      {
        href: ROUTES.adminServices.pettyCashReport,
        title: "Petty cash report",
        description: "Petty cash spend by date range and expense head.",
        Icon: Wallet,
      },
    ],
  },
  {
    title: "Parent-teacher meetings",
    items: [
      {
        href: ROUTES.adminServices.ptmAttendedStatus,
        title: "PTM attended status",
        description: "Record which parents attended their booked meeting.",
        Icon: CalendarCheck,
      },
      {
        href: ROUTES.adminServices.ptmTimeSlotMaster,
        title: "PTM time slot master",
        description: "Define the meeting slots parents can book for a class.",
        Icon: CalendarClock,
      },
      {
        href: ROUTES.adminServices.ptmReport,
        title: "PTM report",
        description: "Booked meetings and whether the parent attended.",
        Icon: CalendarCheck,
      },
    ],
  },
];

export default function AdminServicesIndexPage() {
  return (
    <main className="mx-auto space-y-8 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Admin services</h1>
        <p className="mt-1 text-sm text-slate-500">
          Front-office desks: visitors, complaints, consents, petty cash and parent-teacher meetings.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {group.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map(({ href, title, description, Icon }) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="mb-3 inline-flex rounded-xl bg-blue-50 p-2 text-blue-600">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
