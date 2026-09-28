'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Editor, Element, Frame, useEditor } from '@craftjs/core';
import { ArrowLeft, Eye, Loader2, Save, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/erp-legacy';
import { MobileScreenRoot } from '@/components/mobile-page-builder/blocks/MobileScreenRoot';
import { MobileEditorCanvas } from '@/components/mobile-page-builder/editor/MobileEditorCanvas';
import { MobileToolbox } from '@/components/mobile-page-builder/editor/MobileToolbox';
import { MobileBuilderProvider } from '@/components/mobile-page-builder/editor/MobileBuilderContext';
import { MobilePageRenderer, resolveActionEndpoint } from '@/components/mobile-page-builder/renderer/MobilePageRenderer';
import { RESOLVER, componentToElement, serializeToLayout } from '@/components/mobile-page-builder/shared/layoutTransform';
import { MOBILE_CANVAS_HEIGHT, MOBILE_CANVAS_WIDTH, defaultMobileLayout, type MobileAction, type MobileBackground } from '@/components/mobile-page-builder/shared/layoutTypes';
import { loadPage, publishPage, saveDraft, updatePageMeta, uploadPageAsset, type MobilePageDetail, type MobilePageStatus } from '../../api';

type ToolboxTab = 'add' | 'background' | 'settings' | 'layers';

/**
 * Fetches the page BEFORE <Editor>/<Frame> ever mount, and hands the result
 * to EditorShell as a prop that seeds <Frame>'s initial JSX directly.
 *
 * An earlier version fetched inside a useEffect that ran INSIDE the Editor
 * tree and then mutated the already-mounted tree via
 * actions.setProp('ROOT', ...) / actions.addNodeTree(tree, 'ROOT'). Even on
 * a page with an empty draft (nothing in `components`), that reliably threw
 * Craft.js's "Invariant failed: Node does not exist, it may have been
 * removed" -- targeting 'ROOT' from an async callback isn't safe to assume
 * against a tree Craft itself hasn't necessarily settled yet. Building the
 * whole tree as data first and mounting <Frame> once, already correct, has
 * no such assumption to get wrong.
 */
export default function MobilePageEditorPage() {
  const params = useParams<{ pageId: string }>();
  const pageId = Number(params?.pageId);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState<MobilePageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Craft.js touches the DOM on mount, so the editor is client-only --
  // matches the document-template editor's own identical mount guard.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !Number.isFinite(pageId)) return;

    let cancelled = false;

    (async () => {
      try {
        const loaded = await loadPage(pageId);
        if (!cancelled) setPage(loaded);
      } catch (loadErr: unknown) {
        if (!cancelled) setLoadError(errorMessage(loadErr, 'Could not open this page.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, pageId]);

  if (!mounted || !Number.isFinite(pageId) || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError || !page) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-center">
        <p className="text-sm text-red-600">{loadError || 'This page could not be opened.'}</p>
        <Button variant="outline" onClick={() => router.push('/general/mobile_page_builder')}>
          Back to Mobile Pages
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <Editor resolver={RESOLVER}>
        <EditorShell pageId={pageId} initialPage={page} />
      </Editor>
    </div>
  );
}

function EditorShell({ pageId, initialPage }: { pageId: number; initialPage: MobilePageDetail }) {
  const router = useRouter();
  const { query } = useEditor();

  const [name, setName] = useState(initialPage.name || 'Untitled page');
  // Not editable from this topbar (only Name is) -- read directly rather
  // than carrying a setter nothing ever calls.
  const slug = initialPage.slug;
  const [status, setStatus] = useState<MobilePageStatus>(initialPage.status);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [toolboxTab, setToolboxTab] = useState<ToolboxTab | null>('add');
  const [previewOpen, setPreviewOpen] = useState(false);

  const initialBackground: MobileBackground = initialPage.layout?.page?.background ?? defaultMobileLayout(initialPage.name).page.background;
  const initialComponents = initialPage.layout?.components ?? [];

  const currentLayout = useCallback(() => {
    const background: MobileBackground = query.getNodes().ROOT?.data?.props?.background ?? initialBackground;
    return serializeToLayout(query.getSerializedNodes(), {
      name,
      width: MOBILE_CANVAS_WIDTH,
      height: MOBILE_CANVAS_HEIGHT,
      background,
      dataSource: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, name]);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      setNotice(await saveDraft(pageId, currentLayout()));
    } catch (saveError: unknown) {
      setError(errorMessage(saveError, 'The draft could not be saved.'));
    } finally {
      setSaving(false);
    }
  }, [pageId, currentLayout]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setError('');
    try {
      await saveDraft(pageId, currentLayout());
      const result = await publishPage(pageId);
      setStatus(result.page.status);
      setNotice(result.message);
    } catch (publishError: unknown) {
      setError(errorMessage(publishError, 'The page could not be published.'));
    } finally {
      setPublishing(false);
    }
  }, [pageId, currentLayout]);

  const handleRenameSave = useCallback(async () => {
    try {
      await updatePageMeta(pageId, { name, slug });
      setNotice('Page details saved.');
    } catch (renameError: unknown) {
      setError(errorMessage(renameError, 'Could not save the page name/slug.'));
    }
  }, [pageId, name, slug]);

  return (
    <MobileBuilderProvider pageId={pageId} uploadAsset={(file) => uploadPageAsset(pageId, file)}>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => router.push('/general/mobile_page_builder')}>
            <ArrowLeft className="size-4" />
          </Button>
          <Input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => void handleRenameSave()} className="h-9 max-w-xs font-medium" />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">{status}</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-4" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleSaveDraft()} disabled={saving || publishing}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Draft
          </Button>
          <Button size="sm" onClick={() => void handlePublish()} disabled={saving || publishing}>
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            Publish
          </Button>
        </div>

        {error ? (
          <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
        ) : null}

        <div className="relative flex flex-1 overflow-hidden">
          <div
            className="relative z-20 flex h-full flex-col border-r border-slate-200 bg-white"
            style={{ width: toolboxTab ? '368px' : '80px', transition: 'width 0.2s ease-in-out' }}
          >
            <MobileToolbox activeTab={toolboxTab} setActiveTab={setToolboxTab} />
          </div>

          <MobileEditorCanvas>
            <Frame>
              <Element canvas is={MobileScreenRoot} background={initialBackground}>
                {initialComponents.map((component) => componentToElement(component))}
              </Element>
            </Frame>
          </MobileEditorCanvas>
        </div>
      </div>

      {previewOpen ? <PreviewModal layout={currentLayout()} onClose={() => setPreviewOpen(false)} /> : null}
    </MobileBuilderProvider>
  );
}

function PreviewModal({ layout, onClose }: { layout: ReturnType<typeof serializeToLayout>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="relative max-h-full overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="size-4" />
        </button>
        <p className="mb-3 text-center text-xs font-medium text-slate-500">
          Preview -- actions are simulated here, nothing is actually sent until this is published.
        </p>
        <div
          className="mx-auto w-fit overflow-y-auto overflow-x-hidden rounded-[36px] border-[6px] border-slate-900 shadow-xl"
          style={{ maxHeight: MOBILE_CANVAS_HEIGHT }}
        >
          <MobilePageRenderer
            layout={layout}
            onAction={(action: MobileAction, formValues) => {
              if (action.type === 'api') {
                const endpoint = resolveActionEndpoint(action, formValues) || '(no endpoint set)';
                window.alert(`Preview: would call ${action.method ?? 'POST'} ${endpoint}`);
              } else if (action.type === 'navigate') {
                window.alert(`Preview: would navigate (${action.navigate?.kind === 'page' ? action.navigate.slug : 'back'})`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
