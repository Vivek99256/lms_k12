"use client";
// components/StudentHealthTable.tsx
import React, { useState } from "react";
import { FlaggedStudent } from "../page";
import { Student } from "../../search_student/components/StudentProfilesTab";
import { StudentDetailDrawer } from '../../search_student/components/StudentDetailDrawer';

interface StudentHealthTableProps {
  students: FlaggedStudent[];
}

export default function StudentHealthTable({
  students,
}: StudentHealthTableProps) {
  const [drawerStudent, setDrawerStudent] = useState<Student | null>(null);

  const mapToStudent = (s: FlaggedStudent): Student => ({
    id: s.initials,
    admissionNo: s.initials,
    name: s.name,
    class: s.grade,
    section: s.section,
    rollNo: s.initials,
    gender: "Other",
    dob: "",
    fatherName: "",
    motherName: "",
    guardian: "",
    phone: "",
    email: "",
    address: "",
    house: "",
    bloodGroup: s.bloodGroup,
    status: 'active',
    attendance: 0,
    lastActive: '',
    docsMissing: 0,
    vaccination: s.vaccination === 'Up to date' ? 'vaccinated' : 'not_vaccinated',
    allergy: s.allergies !== 'None' ? s.allergies : null,
    infirmary: s.infirmaryVisits,
  });

  const handleEdit = (student: Student) => {
    console.log("Edit student", student);
  };

  const handleGenerateCertificate = (student: Student) => {
    console.log("Generate certificate", student);
  };

  const handlePrintIDCard = (student: Student) => {
    console.log("Print ID card", student);
  };

  return (<>
    <div className="mt-4">
      <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-3">
          {/* Info Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-sky-600 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
            />
          </svg>

          <div>
            <h3 className="text-sm font-semibold text-sky-900">
              Students with medical conditions or allergies
            </h3>

            <p className="mt-1 text-sm text-sky-700">
              Only students with a recorded condition, allergy, or overdue
              vaccination are shown below. Full health profiles live on each
              student record.
              <span className="ml-2 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                {students.length} flagged
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Blood</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Allergies</th>
              <th className="px-4 py-3">Vaccination</th>
              <th className="px-4 py-3 text-center">Infirmary</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {students.map((student, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                    {student.initials}
                  </div>
                  <div>
                    <span className="block font-semibold text-slate-900">
                      {student.name}
                    </span>
                    <span className="block text-xs text-slate-400 font-normal">
                      Grade {student.grade} · {student.section}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                  {student.bloodGroup}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={
                      student.condition !== "—"
                        ? "text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded"
                        : "text-slate-400"
                    }
                  >
                    {student.condition}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={
                      student.allergies !== "None"
                        ? "text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded"
                        : "text-slate-400"
                    }
                  >
                    {student.allergies}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      student.vaccination === "Up to date"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${student.vaccination === "Up to date" ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    {student.vaccination}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center font-mono text-slate-600">
                  {student.infirmaryVisits}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button
                    onClick={() => setDrawerStudent(mapToStudent(student))}
                    className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                  >
                    <span className="mdi mdi-chevron-right"></span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {/* Student Detail Drawer */}
    <StudentDetailDrawer
      student={drawerStudent}
      onClose={() => {
        setDrawerStudent(null);
      }}
      onEdit={handleEdit}
      onGenerateCertificate={handleGenerateCertificate}
      onPrintIDCard={handlePrintIDCard}
    />
  </>);
}
