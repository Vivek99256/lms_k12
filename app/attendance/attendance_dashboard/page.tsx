// app/students/attendance/page.tsx
"use client";

<<<<<<< HEAD
import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
=======
import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  Save,
  Users,
  UserCheck,
  UserX,
  List,
  Grid,
} from "lucide-react";
import { MetricCard } from "./components/MetricCard";
import { DailyRegister } from "./components/DailyRegister";
import { MonthlyOverview } from "./components/MonthlyOverview";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  ChartOptions,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
<<<<<<< HEAD
=======
import {
  buildSessionContext,
  fetchAttendanceTrend,
  fetchClassSections,
  fetchDailyRegister,
  saveAttendance,
  type AttendanceTrend,
  type ClassSection,
} from "../_lib/attendance-api";
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
);

// Types
export interface AttendanceStudent {
  id: string;
  name: string;
  rollNo: string;
  class: string;
  section: string;
<<<<<<< HEAD
  status: "present" | "absent" | "late" | "leave";
=======
  status: "present" | "absent";
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  admissionNo: string;
  avatar?: string;
}

<<<<<<< HEAD
// Sample Data
const sampleStudents: AttendanceStudent[] = [
  {
    id: "STU001",
    name: "Kiara Kapoor",
    rollNo: "4",
    class: "9",
    section: "A",
    status: "present",
    admissionNo: "ADM-2026-0424",
  },
  {
    id: "STU002",
    name: "Vivaan Chopra",
    rollNo: "14",
    class: "9",
    section: "A",
    status: "present",
    admissionNo: "ADM-2026-0428",
  },
  {
    id: "STU003",
    name: "Arvan Kanon",
    rollNo: "8",
    class: "9",
    section: "A",
    status: "absent",
    admissionNo: "ADM-2026-0430",
  },
  {
    id: "STU004",
    name: "Ananya Gupta",
    rollNo: "2",
    class: "9",
    section: "A",
    status: "present",
    admissionNo: "ADM-2026-0423",
  },
  {
    id: "STU005",
    name: "Ishaan Iyer",
    rollNo: "7",
    class: "9",
    section: "A",
    status: "late",
    admissionNo: "ADM-2026-0422",
  },
  {
    id: "STU006",
    name: "Pari Menon",
    rollNo: "11",
    class: "9",
    section: "A",
    status: "present",
    admissionNo: "ADM-2026-0425",
  },
  {
    id: "STU007",
    name: "Sai Malhotra",
    rollNo: "3",
    class: "9",
    section: "A",
    status: "leave",
    admissionNo: "ADM-2026-0426",
  },
  {
    id: "STU008",
    name: "Aarav Sharma",
    rollNo: "1",
    class: "9",
    section: "A",
    status: "present",
    admissionNo: "ADM-2026-0421",
  },
  {
    id: "STU009",
    name: "Myra Singh",
    rollNo: "5",
    class: "9",
    section: "A",
    status: "present",
    admissionNo: "ADM-2026-0427",
  },
  {
    id: "STU010",
    name: "Reyansh Kumar",
    rollNo: "9",
    class: "9",
    section: "A",
    status: "absent",
    admissionNo: "ADM-2026-0429",
  },
];

const attendanceTrendData = {
  labels: [
    "Jun 23",
    "Jun 24",
    "Jun 25",
    "Jun 26",
    "Jun 27",
    "Jun 30",
    "Jul 01",
    "Jul 02",
  ],
  present: [7, 8, 6, 9, 7, 8, 9, 8],
  absent: [1, 1, 2, 0, 2, 1, 0, 1],
  late: [1, 0, 1, 0, 0, 1, 0, 0],
  leave: [1, 1, 1, 1, 1, 0, 1, 1],
};
=======
const emptyTrend: AttendanceTrend = { labels: [], present: [], absent: [] };

function sectionLabel(section: ClassSection): string {
  return `${section.standardName} - ${section.divisionName}`;
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());
<<<<<<< HEAD
  const [selectedClass, setSelectedClass] = useState("9-A");
  const [students, setStudents] = useState<AttendanceStudent[]>(sampleStudents);
=======
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<ClassSection | null>(null);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [attendanceTrendData, setAttendanceTrendData] = useState<AttendanceTrend>(emptyTrend);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedClass = selectedSection ? sectionLabel(selectedSection) : "";

  useEffect(() => {
    let cancelled = false;

    async function loadSections() {
      try {
        const session = buildSessionContext();
        const fetchedSections = await fetchClassSections(session);
        if (cancelled) return;
        setSections(fetchedSections);
        setSelectedSection((prev) => prev ?? fetchedSections[0] ?? null);
        if (fetchedSections.length === 0) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load class sections.");
          setLoading(false);
        }
      }
    }

    loadSections();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSection) return;
    let cancelled = false;

    async function loadAttendance() {
      setLoading(true);
      setError(null);
      setSaveMessage(null);
      setSaveError(null);
      try {
        const session = buildSessionContext();
        const dateStr = selectedDate.toISOString().slice(0, 10);
        const [register, trend] = await Promise.all([
          fetchDailyRegister(session, selectedSection as ClassSection, dateStr),
          fetchAttendanceTrend(session, selectedSection as ClassSection, selectedDate),
        ]);
        if (cancelled) return;
        setStudents(register);
        setAttendanceTrendData(trend);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load attendance data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAttendance();
    return () => {
      cancelled = true;
    };
  }, [selectedSection, selectedDate]);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const totalStudents = students.length;
  const presentCount = students.filter((s) => s.status === "present").length;
  const absentCount = students.filter((s) => s.status === "absent").length;
<<<<<<< HEAD
  const lateCount = students.filter((s) => s.status === "late").length;
  const leaveCount = students.filter((s) => s.status === "leave").length;
  const attendancePercentage = Math.round((presentCount / totalStudents) * 100);
=======
  const attendancePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  const handleStatusChange = (
    studentId: string,
    newStatus: AttendanceStudent["status"],
  ) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, status: newStatus } : student,
      ),
    );
  };

  const handleMarkAllPresent = () => {
    setStudents((prev) =>
      prev.map((student) => ({ ...student, status: "present" as const })),
    );
  };

<<<<<<< HEAD
  const handleSaveAttendance = () => {
    console.log("Saving attendance...", students);
=======
  const handleSaveAttendance = async () => {
    if (!selectedSection || students.length === 0 || saving) return;

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const session = buildSessionContext();
      const dateStr = selectedDate.toISOString().slice(0, 10);
      const message = await saveAttendance(
        session,
        selectedSection,
        dateStr,
        students.map((student) => ({ id: student.id, status: student.status })),
      );
      setSaveMessage(message);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  };

  // Attendance Trend Chart
  const trendChartData = {
    labels: attendanceTrendData.labels,
    datasets: [
      {
        label: "Present",
        data: attendanceTrendData.present,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#10b981",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
      {
        label: "Absent",
        data: attendanceTrendData.absent,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#ef4444",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
<<<<<<< HEAD
      {
        label: "Late",
        data: attendanceTrendData.late,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#f59e0b",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
      {
        label: "Leave",
        data: attendanceTrendData.leave,
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#8b5cf6",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
=======
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    ],
  };

  const trendOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: "circle",
          color: "#64748b",
          font: { size: 11 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 12,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        max: 10,
        grid: { color: "#e2e8f0" },
        ticks: { color: "#64748b", font: { size: 10 }, stepSize: 1 },
      },
    },
  };

  // Doughnut Chart Data
  const doughnutData = {
<<<<<<< HEAD
    labels: ["Present", "Absent", "Late", "Leave"],
    datasets: [
      {
        data: [presentCount, absentCount, lateCount, leaveCount],
        backgroundColor: ["#10b981", "#ef4444", "#f59e0b", "#8b5cf6"],
=======
    labels: ["Present", "Absent"],
    datasets: [
      {
        data: [presentCount, absentCount],
        backgroundColor: ["#10b981", "#ef4444"],
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        borderColor: "#ffffff",
        borderWidth: 3,
      },
    ],
  };

  const doughnutOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: "circle",
          color: "#64748b",
          font: { size: 11 },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 12,
        callbacks: {
          label: function (context) {
            const total = context.dataset.data.reduce(
              (a: number, b: number) => a + b,
              0,
            );
            const percentage = Math.round((context.parsed / total) * 100);
            return `${context.label}: ${context.parsed} (${percentage}%)`;
          },
        },
      },
    },
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage student attendance
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#3f5bf6] text-white rounded-lg font-medium hover:bg-[#3552e0] transition-colors shadow-sm">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

<<<<<<< HEAD
      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
=======
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading attendance...
        </div>
      ) : (
        <>
      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        <MetricCard
          title="Present"
          value={String(presentCount)}
          icon={<UserCheck className="h-4 w-4" />}
          variant="success"
        />
        <MetricCard
          title="Absent"
          value={String(absentCount)}
          icon={<UserX className="h-4 w-4" />}
          variant="danger"
        />
        <MetricCard
<<<<<<< HEAD
          title="Late"
          value={String(lateCount)}
          icon={<Clock className="h-4 w-4" />}
          variant="warning"
        />
        <MetricCard
=======
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          title="Class attendance"
          value={`${attendancePercentage}%`}
          icon={<Users className="h-4 w-4" />}
          variant="default"
<<<<<<< HEAD
          trend={{ direction: "up", value: "+1.4%", label: "vs last week" }}
=======
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Doughnut Chart - Today's Marking */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-950">
              Today&rsquo;s marking
            </h3>
            <p className="text-xs text-slate-500">
              Live split for Grade {selectedClass} — updates as you mark
            </p>
          </div>
          <div className="h-64">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </section>

        {/* Line Chart - Attendance Trend */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-950">
              Attendance trend
            </h3>
            <p className="text-xs text-slate-500">
              Class attendance % over the last eight school days
            </p>
          </div>
          <div className="h-64">
            <Line data={trendChartData} options={trendOptions} />
          </div>
        </section>
      </div>

      {/* Tabbed Register */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-2 lg:flex-row lg:items-center lg:justify-between">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDate(newDate);
              }}
              className="flex h-9 w-9 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="min-w-[fit-content] text-center text-sm font-semibold text-slate-950">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedDate(newDate);
              }}
              className="flex h-9 w-9 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            {/* Grade + count */}
            <div className="flex items-center gap-3">
              <div className="hidden h-6 w-px bg-slate-200 lg:block" />
              <div className="flex items-center gap-2">
                <select
<<<<<<< HEAD
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="h-9 rounded border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
                >
                  <option value="9-A">Grade 9 - A</option>
                  <option value="9-B">Grade 9 - B</option>
                  <option value="10-A">Grade 10 - A</option>
                  <option value="10-B">Grade 10 - B</option>
=======
                  value={selectedSection ? `${selectedSection.standardId}||${selectedSection.divisionId}` : ""}
                  onChange={(e) => {
                    const next = sections.find(
                      (section) => `${section.standardId}||${section.divisionId}` === e.target.value,
                    );
                    if (next) setSelectedSection(next);
                  }}
                  className="h-9 rounded border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-[#3f5bf6] focus:ring-2 focus:ring-[#3f5bf6]/15"
                >
                  {sections.length === 0 && <option value="">No classes assigned</option>}
                  {sections.map((section) => (
                    <option
                      key={`${section.standardId}||${section.divisionId}`}
                      value={`${section.standardId}||${section.divisionId}`}
                    >
                      Grade {sectionLabel(section)}
                    </option>
                  ))}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                </select>
              </div>
              <span className="hidden text-sm text-slate-500 lg:inline">
                {totalStudents} students - Grade {selectedClass}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-[#f3f3f3] rounded p-1 border-1">
              <button
                onClick={() => setActiveTab("daily")}
                className={`flex items-center gap-1 px-2 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === "daily"
                    ? "bg-[#fff] rounded"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <List className="w-4 h-4" />
                Daily register
              </button>
              <button
                onClick={() => setActiveTab("monthly")}
                className={`flex items-center gap-1 px-2 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === "monthly"
                    ? "bg-[#fff] rounded"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Grid className="w-4 h-4" />
                Month overview
              </button>
            </div>
            <button
              onClick={handleMarkAllPresent}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#0F172A text-[#4f46e5] bg-[#eef2ff] px-4 py-2 text-sm font-medium sm:flex-none"
            >
              <UserCheck className="w-4 h-4" />
              Mark all present
            </button>
            <button
              onClick={handleSaveAttendance}
<<<<<<< HEAD
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3f5bf6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3552e0] sm:flex-none"
            >
              <Save className="w-4 h-4" />
=======
              disabled={saving || students.length === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3f5bf6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3552e0] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
              Save attendance
            </button>
          </div>
        </div>

<<<<<<< HEAD
=======
        {(saveMessage || saveError) && (
          <div
            className={`mx-4 mt-2 rounded-lg px-3 py-2 text-sm ${
              saveError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {saveError || saveMessage}
          </div>
        )}

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        {activeTab === "daily" ? (
          <DailyRegister
            students={students}
            onStatusChange={handleStatusChange}
            selectedDate={selectedDate}
            selectedClass={selectedClass}
            getInitials={getInitials}
          />
        ) : (
<<<<<<< HEAD
          <MonthlyOverview
            selectedDate={selectedDate}
            selectedClass={selectedClass}
          />
        )}
      </div>
=======
          selectedSection && (
            <MonthlyOverview
              selectedDate={selectedDate}
              selectedClass={selectedClass}
              section={selectedSection}
              totalStudents={totalStudents}
            />
          )
        )}
      </div>
        </>
      )}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    </div>
  );
}
