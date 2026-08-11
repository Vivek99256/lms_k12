'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '@craftjs/core';
import { Eye, EyeOff, Loader2, Search, TriangleAlert, X } from 'lucide-react';

import {
  fetchMergeData,
  searchPreviewStudents,
  type PreviewStudent,
} from '@/app/document-templates/api';
import { applyMergeValues, findUnknownTokens } from '../merge';
import { ToolButton, toast } from './ui';

/**
 * Preview with real data.
 *
 * Picking a student swaps every `{{token}}` on the canvas for that student's
 * value, so a designer sees the document exactly as it will print. This is
 * strictly a *view*: the token version is serialized and held before the swap
 * and restored on exit, so previewing can never bake one student's data into
 * the saved template. Editing is disabled while previewing to make that
 * guarantee obvious rather than merely true.
 */
export const PreviewBar = () => {
  const { actions, query } = useEditor();

  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<PreviewStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<PreviewStudent | null>(null);
  const [unknownTokens, setUnknownTokens] = useState<string[]>([]);

  /** The editable, token-bearing document, held while a preview is on screen. */
  const editableContentRef = useRef<string | null>(null);

  // Debounced student search — only while the picker is actually open.
  useEffect(() => {
    if (!pickerOpen) return;

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      setStudentsLoading(true);
      searchPreviewStudents(search, controller.signal)
        .then((result) => {
          setStudents(result);
          setStudentsLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setStudents([]);
          setStudentsLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, pickerOpen]);

  const enterPreview = async (student: PreviewStudent | null) => {
    setApplying(true);
    setPickerOpen(false);

    try {
      // Capture the editable document only on the way *in*, so previewing a
      // second student never snapshots an already-merged document.
      const source = editableContentRef.current ?? query.serialize();
      editableContentRef.current = source;

      const values = await fetchMergeData({ studentId: student ? String(student.id) : '' });

      setUnknownTokens(findUnknownTokens(source, values));
      actions.deserialize(applyMergeValues(source, values));
      actions.setOptions((options) => {
        options.enabled = false;
      });

      setSelectedStudent(student);
      setPreviewing(true);
    } catch (error) {
      // A failed merge must not strand the designer in a half-applied state.
      if (editableContentRef.current) {
        actions.deserialize(editableContentRef.current);
        editableContentRef.current = null;
      }
      actions.setOptions((options) => {
        options.enabled = true;
      });
      setPreviewing(false);
      toast({
        title: 'Could not build the preview',
        description: error instanceof Error ? error.message : 'Please try again.',
        tone: 'error',
      });
    } finally {
      setApplying(false);
    }
  };

  const exitPreview = () => {
    if (editableContentRef.current) {
      actions.deserialize(editableContentRef.current);
      editableContentRef.current = null;
    }
    actions.setOptions((options) => {
      options.enabled = true;
    });
    setPreviewing(false);
    setSelectedStudent(null);
    setUnknownTokens([]);
  };

  return (
    <div className="relative z-40 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
      <div className="flex items-center gap-2">
        {previewing ? (
          <ToolButton variant="default" onClick={exitPreview}>
            <EyeOff />
            Exit preview
          </ToolButton>
        ) : (
          <ToolButton onClick={() => void enterPreview(null)} disabled={applying}>
            {applying ? <Loader2 className="animate-spin" /> : <Eye />}
            Preview with school data
          </ToolButton>
        )}

        <ToolButton onClick={() => setPickerOpen((open) => !open)} disabled={applying}>
          <Search />
          {selectedStudent ? selectedStudent.name : 'Preview with a student'}
        </ToolButton>

        {selectedStudent ? (
          <ToolButton
            variant="ghost"
            size="icon"
            onClick={exitPreview}
            title="Clear student"
            aria-label="Clear student"
          >
            <X />
          </ToolButton>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        {previewing
          ? 'Read-only preview — merge fields show real values. Exit to keep editing.'
          : 'Merge fields print as {{tokens}} until a document is generated.'}
      </p>

      {unknownTokens.length > 0 ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
          <TriangleAlert className="size-3.5 shrink-0" />
          Unknown {unknownTokens.length === 1 ? 'field' : 'fields'}:{' '}
          <span className="font-mono">{unknownTokens.map((token) => `{{${token}}}`).join(', ')}</span>
        </p>
      ) : null}

      {pickerOpen ? (
        <div className="absolute top-full left-4 z-50 mt-1.5 w-96 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or admission number"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-2.5 pl-8 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {studentsLoading ? (
              <div className="flex h-20 items-center justify-center text-sm text-slate-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Searching…
              </div>
            ) : students.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No students found.</p>
            ) : (
              <ul className="flex flex-col">
                {students.map((student) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => void enterPreview(student)}
                      className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-blue-50"
                    >
                      <span className="block truncate text-sm text-slate-800">{student.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {[
                          student.standard && `Class ${student.standard}`,
                          student.division,
                          student.admissionId && `Adm ${student.admissionId}`,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No enrollment on file'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-200 p-2">
            <ToolButton variant="ghost" onClick={() => setPickerOpen(false)}>
              Close
            </ToolButton>
          </div>
        </div>
      ) : null}
    </div>
  );
};
