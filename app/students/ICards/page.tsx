"use client";

import React from "react";
import {
  CreditCard,
  UserCheck,
  Layers,
  QrCode,
  Printer,
  Camera,
  Settings,
} from "lucide-react";
import { Info } from "lucide-react";

interface StudentPreview {
  schoolName: string;
  cardTitle: string;
  name: string;
  admissionNo: string;
  gradeClass: string;
  house: string;
  bloodGroup: string;
  emergencyContact: string;
  validTill: string;
  initials: string;
  photoUrl?: string;
}

interface IdCardsContentProps {
  student?: StudentPreview;
  onGenerateStudentCards?: () => void;
  onGenerateStaffCards?: () => void;
  onBulkPrintCards?: () => void;
}

const DEFAULT_STUDENT: StudentPreview = {
  schoolName: "Hills High School",
  cardTitle: "STUDENT IDENTITY CARD",
  name: "Kiara Kapoor",
  admissionNo: "ADM-2026-0424",
  gradeClass: "Grade 9 - A",
  house: "Vindhya",
  bloodGroup: "AB+",
  emergencyContact: "+91 9800112519",
  validTill: "31 Mar 2027",
  initials: "KK",
};

export const IdCardsContent: React.FC<IdCardsContentProps> = ({
  student = DEFAULT_STUDENT,
  onGenerateStudentCards,
  onGenerateStaffCards,
  onBulkPrintCards,
}) => {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Main Grid Layout - 50/50 split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: ID Card Preview (50%) */}
          <div className="flex justify-center">
            <div className="w-full max-w-[420px] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg flex flex-col">
              {/* Card Header */}
              <div className="bg-[#0D6EFD] text-white p-5 flex items-start gap-3">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm tracking-wide leading-tight">
                    {student.schoolName}
                  </h4>
                  <p className="text-[10px] text-white/60 font-medium tracking-wider mt-0.5">
                    {student.cardTitle}
                  </p>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 bg-white">
                {/* Profile Section */}
                <div className="flex items-center gap-4 mb-5">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center border-2 border-indigo-200 shadow-sm flex-shrink-0">
                    <span className="text-xl font-bold text-indigo-700">
                      {student.initials}
                    </span>
                  </div>

                  {/* Name & Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">
                      {student.name}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono">
                      {student.admissionNo}
                    </p>
                    <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                      {student.gradeClass}
                    </span>
                  </div>
                </div>

                {/* Identity Details */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-400 font-medium">
                      Class
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {student.gradeClass}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-400 font-medium">
                      House
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {student.house}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-400 font-medium">
                      Blood group
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {student.bloodGroup}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-xs text-gray-400 font-medium">
                      Emergency
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {student.emergencyContact}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center justify-between">
                <div className="text-[10px] text-gray-400 font-medium">
                  Valid till{" "}
                  <span className="text-gray-700 font-semibold">
                    {student.validTill}
                  </span>
                </div>

                {/* Barcode Mock */}
                <div
                  className="flex items-center gap-[2px] h-7"
                  aria-hidden="true"
                >
                  {[2, 4, 1, 3, 5, 2, 1, 4, 3, 1, 5, 2, 3, 1, 4, 2, 1].map(
                    (weight, index) => (
                      <div
                        key={index}
                        className="bg-gray-700 h-full"
                        style={{ width: `${weight}px` }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Operations Panel (50%) */}
          <div className="space-y-6">
            {/* Main Card Operations Block */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  Card operations
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Generate and print identity cards for students and staff.
                </p>
              </div>

              <div className="space-y-4">
                {/* Action Item 1: Student Cards */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <QrCode className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">
                        Generate student ID card
                      </h4>
                      <p className="text-xs text-gray-400">
                        Digital card with QR &amp; barcode
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onGenerateStudentCards}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-black rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Generate
                  </button>
                </div>

                {/* Action Item 2: Teacher / Staff Cards */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">
                        Teacher / staff ID cards
                      </h4>
                      <p className="text-xs text-gray-400">
                        Professional identification
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onGenerateStaffCards}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-black rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Generate
                  </button>
                </div>

                {/* Action Item 3: Bulk Printing */}
                <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Layers className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">
                        Bulk card printing
                      </h4>
                      <p className="text-xs text-gray-400">
                        Print a whole class or house at once
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onBulkPrintCards}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0D6EFD] hover:bg-[#0D6EFD] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Bulk print
                  </button>
                </div>
              </div>
            </div>

            {/* Photo Attendance Info Box */}
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-blue-900">
                      Photo attendance ready
                    </h4>

                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      92%
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-blue-700 leading-relaxed">
                    <strong>92 of 100 students</strong> have an approved photo
                    on file. Bulk photo upload and facial-recognition attendance
                    can be configured from{" "}
                    <span className="font-medium">Settings</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardsContent;
