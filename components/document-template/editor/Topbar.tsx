'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor } from '@craftjs/core';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';

import {
  createTemplate,
  deleteTemplate,
  fetchVersions,
  restoreVersion,
  updateTemplate,
  type TemplateCategory,
  type TemplateStatus,
  type TemplateVersionSummary,
} from '@/app/document-templates/api';
import { createA4PageNodeTree, scrollPageIntoView } from './utils/documentModel';
import { Menu, MenuItem, ToolButton, fieldClass, toast } from './ui';

const CATEGORY_OPTIONS: { value: TemplateCategory; label: string }[] = [
  { value: 'certificate', label: 'Certificate' },
  { value: 'id_card', label: 'ID card' },
  { value: 'fees', label: 'Fee document' },
  { value: 'admission', label: 'Admission document' },
  { value: 'exam', label: 'Exam document' },
  { value: 'circular', label: 'Circular' },
  { value: 'general', label: 'General' },
];

export interface TopbarProps {
  /** Set once the template exists in the database, so Save becomes Save changes. */
  savedId: number | null;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  onSaved: (template: {
    id: number;
    name: string;
    category: TemplateCategory;
    status: TemplateStatus;
  }) => void;
  /** Replaces the canvas after a version restore. */
  onContentReplaced: (content: string) => void;
}

export const Topbar = ({
  savedId,
  name,
  category,
  status,
  onSaved,
  onContentReplaced,
}: TopbarProps) => {
  const router = useRouter();
  const { actions, query } = useEditor();

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<TemplateVersionSummary[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const [draftName, setDraftName] = useState(name);
  const [draftCategory, setDraftCategory] = useState<TemplateCategory>(category);

  // Keep the save-dialog fields in step with the loaded template. Adjusted
  // during render rather than in an effect, so the dialog never opens showing
  // the previous template's name for a frame.
  const [lastMeta, setLastMeta] = useState({ name, category });
  if (lastMeta.name !== name || lastMeta.category !== category) {
    setLastMeta({ name, category });
    setDraftName(name);
    setDraftCategory(category);
  }

  // ── Undo / redo ────────────────────────────────────────────────────────
  // Craft.js exposes no history-change subscription, so the enabled state is
  // polled. 250ms is imperceptible for a toolbar affordance and costs nothing.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const refreshHistory = useCallback(() => {
    try {
      setCanUndo(query.history.canUndo());
      setCanRedo(query.history.canRedo());
    } catch {
      /* editor not ready */
    }
  }, [query]);

  useEffect(() => {
    // The first tick lands within 250ms; until then the initial disabled state
    // is already correct, since a freshly mounted editor has no history.
    const interval = window.setInterval(refreshHistory, 250);
    return () => window.clearInterval(interval);
  }, [refreshHistory]);

  const handleUndo = useCallback(() => {
    try {
      actions.history.undo();
      requestAnimationFrame(refreshHistory);
    } catch {
      /* nothing to undo */
    }
  }, [actions, refreshHistory]);

  const handleRedo = useCallback(() => {
    try {
      actions.history.redo();
      requestAnimationFrame(refreshHistory);
    } catch {
      /* nothing to redo */
    }
  }, [actions, refreshHistory]);

  // Ctrl/Cmd+Z is only ours when focus sits outside a text editor — inside
  // Tiptap its own history must win, or typing becomes unrecoverable.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        target?.closest?.('[contenteditable="true"]')
      ) {
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // ── Persistence ────────────────────────────────────────────────────────

  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'Something went wrong. Please try again.';

  const persist = async (templateName: string, templateCategory: TemplateCategory) => {
    const content = query.serialize();
    setSaving(true);

    try {
      if (savedId) {
        const saved = await updateTemplate(savedId, {
          name: templateName,
          category: templateCategory,
          content,
          status,
        });
        onSaved({ id: saved.id, name: saved.name, category: saved.category, status: saved.status });
        toast({ title: 'Template updated', description: `Saved as version ${saved.version}.` });
      } else {
        const saved = await createTemplate({
          name: templateName,
          category: templateCategory,
          content,
          status: 'draft',
        });
        onSaved({ id: saved.id, name: saved.name, category: saved.category, status: saved.status });
        toast({ title: 'Template saved' });
        // Re-anchor the URL to the database id, so a refresh reopens the saved
        // template rather than a fresh empty draft.
        router.replace(`/document-templates/editor/${saved.id}`);
      }
    } catch (error) {
      toast({ title: 'Could not save', description: errorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (savedId) {
      void persist(name, category);
      return;
    }
    setDraftName(name === 'Untitled template' ? '' : name);
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = async () => {
    if (!draftName.trim()) {
      toast({ title: 'Enter a template name', tone: 'error' });
      return;
    }
    setShowSaveDialog(false);
    await persist(draftName.trim(), draftCategory);
  };

  const handleDelete = async () => {
    if (!savedId) return;
    if (!window.confirm('Delete this template? This cannot be undone.')) return;

    try {
      await deleteTemplate(savedId);
      toast({ title: 'Template deleted' });
      router.push('/document-templates');
    } catch (error) {
      toast({ title: 'Could not delete', description: errorMessage(error), tone: 'error' });
    }
  };

  const handleAddPage = () => {
    const rootNode = query.node('ROOT').get();
    if (!rootNode || rootNode.data.name !== 'DocumentContainer') return;

    // Built from the serialized resolver name rather than the component itself,
    // so hot reloads cannot break node identity and saved JSON stays stable.
    const newPage = createA4PageNodeTree(query);
    actions.addNodeTree(newPage, 'ROOT');
    actions.selectNode(newPage.rootNodeId);
    scrollPageIntoView(newPage.rootNodeId);
    toast({ title: 'Page added' });
  };

  // ── Versions ───────────────────────────────────────────────────────────

  const openVersions = async () => {
    if (!savedId) return;
    setShowVersions(true);
    setVersionsLoading(true);
    try {
      const result = await fetchVersions(savedId);
      setVersions(result.versions);
    } catch (error) {
      toast({ title: 'Could not load history', description: errorMessage(error), tone: 'error' });
      setShowVersions(false);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestore = async (version: number) => {
    if (!savedId) return;
    try {
      const restored = await restoreVersion(savedId, version);
      onContentReplaced(restored.content);
      setShowVersions(false);
      toast({ title: `Restored version ${version}` });
    } catch (error) {
      toast({ title: 'Could not restore', description: errorMessage(error), tone: 'error' });
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = async (format: 'pdf' | 'png' | 'jpg') => {
    const element = document.getElementById('editor-canvas');
    if (!element) return;

    setExporting(true);
    // Clear the selection so focus rings are not baked into the output.
    actions.selectNode();

    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;

    try {
      // Capture at 1:1 — the on-screen zoom must not scale the printed output.
      element.style.transition = 'none';
      element.style.transform = 'scale(1)';
      await new Promise((resolve) => window.setTimeout(resolve, 80));

      // Loaded on demand: html2canvas + jsPDF are heavy and only needed the
      // moment someone actually exports.
      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'template';

      if (format === 'pdf') {
        const pages = Array.from(element.querySelectorAll('[data-craft-node="A4PageBlock"]'));
        const pdf = new JsPDF('p', 'mm', 'a4');

        for (let index = 0; index < pages.length; index += 1) {
          const canvas = await html2canvas(pages[index] as HTMLElement, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
          });
          if (index > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/jpeg', 1), 'JPEG', 0, 0, 210, 297);
        }

        pdf.save(`${safeName}.pdf`);
      } else {
        const canvas = await html2canvas(element, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
        link.download = `${safeName}.${format}`;
        link.click();
      }

      toast({ title: `Exported as ${format.toUpperCase()}` });
    } catch (error) {
      toast({ title: 'Export failed', description: errorMessage(error), tone: 'error' });
    } finally {
      element.style.transform = originalTransform;
      element.style.transition = originalTransition;
      setExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <ToolButton
          variant="ghost"
          size="icon"
          onClick={() => router.push('/document-templates')}
          title="Back to templates"
          aria-label="Back to templates"
        >
          <ArrowLeft />
        </ToolButton>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">
            {CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'General'}
            {savedId ? ` · ID ${savedId}` : ' · Unsaved'}
          </p>
        </div>

        <div className="ml-2 flex items-center gap-0.5 border-l border-slate-200 pl-3">
          <ToolButton
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 />
          </ToolButton>
          <ToolButton
            variant="ghost"
            size="icon"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 />
          </ToolButton>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ToolButton onClick={handleAddPage}>
          <Plus />
          Add page
        </ToolButton>

        {savedId ? (
          <ToolButton onClick={openVersions}>
            <History />
            History
          </ToolButton>
        ) : null}

        <Menu
          trigger={({ toggle }) => (
            <ToolButton onClick={toggle} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              Export
              <ChevronDown className="size-3" />
            </ToolButton>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  close();
                  void handleExport('pdf');
                }}
              >
                <FileText />
                Export PDF
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  void handleExport('png');
                }}
              >
                <ImageIcon />
                Export PNG
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  void handleExport('jpg');
                }}
              >
                <ImageIcon />
                Export JPG
              </MenuItem>
            </>
          )}
        </Menu>

        {savedId ? (
          <ToolButton variant="danger" onClick={handleDelete} title="Delete template" aria-label="Delete template">
            <Trash2 />
          </ToolButton>
        ) : null}

        <ToolButton variant="default" size="md" onClick={handleSaveClick} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {savedId ? 'Save changes' : 'Save'}
        </ToolButton>
      </div>

      {showSaveDialog ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Save template</h3>
            <p className="mt-1 text-sm text-slate-500">
              Give the template a name and file it under a category.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="template-name"
                  className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Template name
                </label>
                <input
                  id="template-name"
                  autoFocus
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSaveConfirm();
                  }}
                  placeholder="Bonafide certificate"
                  className={fieldClass}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="template-category"
                  className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Category
                </label>
                <select
                  id="template-category"
                  value={draftCategory}
                  onChange={(event) => setDraftCategory(event.target.value as TemplateCategory)}
                  className={fieldClass}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <ToolButton size="md" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </ToolButton>
              <ToolButton variant="default" size="md" onClick={handleSaveConfirm}>
                Save template
              </ToolButton>
            </div>
          </div>
        </div>
      ) : null}

      {showVersions ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Version history</h3>
              <p className="mt-1 text-sm text-slate-500">
                Restoring keeps the current version in history, so it is reversible.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {versionsLoading ? (
                <div className="flex h-24 items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading history…
                </div>
              ) : versions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No earlier versions yet. The first edit after a save creates one.
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {versions.map((version) => (
                    <li
                      key={version.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">Version {version.version}</p>
                        <p className="truncate text-xs text-slate-500">
                          {version.name} · {version.createdAt || 'Unknown date'}
                        </p>
                      </div>
                      <ToolButton onClick={() => handleRestore(version.version)}>Restore</ToolButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <ToolButton size="md" onClick={() => setShowVersions(false)}>
                Close
              </ToolButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
