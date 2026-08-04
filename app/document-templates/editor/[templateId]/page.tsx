'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Editor, Element, Frame, useEditor } from '@craftjs/core';

import { Topbar } from '@/components/document-template/editor/Topbar';
import { Toolbox } from '@/components/document-template/editor/Toolbox';
import { EditorCanvas } from '@/components/document-template/editor/EditorCanvas';
import {
  FloatingToolbar,
  type WhiteboardTool,
} from '@/components/document-template/editor/FloatingToolbar';
import { ToastViewport } from '@/components/document-template/editor/ui';
import { PreviewBar } from '@/components/document-template/editor/PreviewBar';
import {
  createEmptyDocument,
  normalizeTemplateDocument,
} from '@/components/document-template/editor/utils/documentModel';

import { TextBlock } from '@/components/document-template/blocks/TextBlock';
import { ImageBlock } from '@/components/document-template/blocks/ImageBlock';
import { ContainerBlock } from '@/components/document-template/blocks/ContainerBlock';
import { A4PageBlock } from '@/components/document-template/blocks/A4PageBlock';
import { DocumentContainer } from '@/components/document-template/blocks/DocumentContainer';
import { ButtonBlock } from '@/components/document-template/blocks/ButtonBlock';
import { DividerBlock } from '@/components/document-template/blocks/DividerBlock';
import { GridBlock } from '@/components/document-template/blocks/GridBlock';
import { ShapeBlock } from '@/components/document-template/blocks/ShapeBlock';
import { TableBlock } from '@/components/document-template/blocks/TableBlock';
import { DrawingBlock } from '@/components/document-template/blocks/DrawingBlock';
import { LineBlock } from '@/components/document-template/blocks/LineBlock';

import { fetchTemplate, type TemplateCategory, type TemplateStatus } from '@/app/document-templates/api';

const RESOLVER = {
  TextBlock,
  ImageBlock,
  ContainerBlock,
  A4PageBlock,
  DocumentContainer,
  ButtonBlock,
  DividerBlock,
  GridBlock,
  ShapeBlock,
  TableBlock,
  DrawingBlock,
  LineBlock,
};

interface TemplateMeta {
  savedId: number | null;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
}

export default function DocumentTemplateEditorPage() {
  const params = useParams<{ templateId: string }>();
  const templateId = params?.templateId ?? 'new';

  // Craft.js touches the DOM on mount, so the editor is client-only.
  const [mounted, setMounted] = useState(false);
  const [toolboxTab, setToolboxTab] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<WhiteboardTool>('select');
  const [isFloatingToolbarVisible, setIsFloatingToolbarVisible] = useState(true);

  const [meta, setMeta] = useState<TemplateMeta>({
    savedId: null,
    name: 'Untitled template',
    category: 'general',
    status: 'draft',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSetToolboxTab = (tab: string | null) => {
    setToolboxTab(tab);
    if (tab) setIsFloatingToolbarVisible(false);
  };

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Starting the designer…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <Editor resolver={RESOLVER}>
        <EditorShell
          templateId={templateId}
          meta={meta}
          setMeta={setMeta}
          toolboxTab={toolboxTab}
          setToolboxTab={handleSetToolboxTab}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          isFloatingToolbarVisible={isFloatingToolbarVisible}
          setIsFloatingToolbarVisible={setIsFloatingToolbarVisible}
        />
      </Editor>
      <ToastViewport />
    </div>
  );
}

/**
 * Everything below lives inside <Editor> so it can use useEditor().
 */
function EditorShell({
  templateId,
  meta,
  setMeta,
  toolboxTab,
  setToolboxTab,
  activeTool,
  setActiveTool,
  isFloatingToolbarVisible,
  setIsFloatingToolbarVisible,
}: {
  templateId: string;
  meta: TemplateMeta;
  setMeta: React.Dispatch<React.SetStateAction<TemplateMeta>>;
  toolboxTab: string | null;
  setToolboxTab: (tab: string | null) => void;
  activeTool: WhiteboardTool;
  setActiveTool: (tool: WhiteboardTool) => void;
  isFloatingToolbarVisible: boolean;
  setIsFloatingToolbarVisible: (visible: boolean) => void;
}) {
  const { actions } = useEditor();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // `actions` is a new object on every editor state change, so it is held in a
  // ref: including it in the effect deps would re-run the loader on each
  // selection change and wipe the canvas. The ref is refreshed in an effect
  // (not during render) so rendering stays free of side effects; effects run in
  // declaration order, so it is current before the loader below reads it.
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;

    let cancelled = false;
    const controller = new AbortController();

    const applyContent = (content: string) => {
      try {
        actionsRef.current.deserialize(normalizeTemplateDocument(content));
      } catch (error) {
        console.error('Failed to open the template document', error);
        actionsRef.current.deserialize(createEmptyDocument());
      }
    };

    (async () => {
      if (templateId === 'new' || !/^\d+$/.test(templateId)) {
        applyContent(createEmptyDocument());
        hasLoaded.current = true;
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const template = await fetchTemplate(templateId, controller.signal);
        if (cancelled) return;

        setMeta({
          savedId: template.id,
          name: template.name || 'Untitled template',
          category: template.category,
          status: template.status,
        });
        applyContent(template.content);
        hasLoaded.current = true;
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setLoadError(
          error instanceof Error ? error.message : 'Could not open this template.'
        );
        applyContent(createEmptyDocument());
        hasLoaded.current = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [templateId, setMeta]);

  const handleSaved = useCallback(
    (saved: { id: number; name: string; category: TemplateCategory; status: TemplateStatus }) => {
      setMeta({
        savedId: saved.id,
        name: saved.name,
        category: saved.category,
        status: saved.status,
      });
    },
    [setMeta]
  );

  const handleContentReplaced = useCallback((content: string) => {
    try {
      actionsRef.current.deserialize(normalizeTemplateDocument(content));
    } catch (error) {
      console.error('Failed to replace the template document', error);
    }
  }, []);

  return (
    <>
      <Topbar
        savedId={meta.savedId}
        name={meta.name}
        category={meta.category}
        status={meta.status}
        onSaved={handleSaved}
        onContentReplaced={handleContentReplaced}
      />

      <PreviewBar />

      {loadError ? (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {loadError}
        </div>
      ) : null}

      <div className="relative flex flex-1 overflow-hidden">
        <div
          className="relative z-20 flex h-full flex-col border-r border-slate-200 bg-white"
          style={{ width: toolboxTab ? '368px' : '80px', transition: 'width 0.25s ease-in-out' }}
        >
          <Toolbox
            activeTab={toolboxTab}
            setActiveTab={setToolboxTab}
            isFloatingToolbarVisible={isFloatingToolbarVisible}
            toggleFloatingToolbar={() => {
              const next = !isFloatingToolbarVisible;
              setIsFloatingToolbarVisible(next);
              if (next) setToolboxTab(null);
            }}
          />
        </div>

        <div className="relative flex flex-1 overflow-hidden">
          {/* Portal target for the text block's bubble menu, so it centres over the canvas. */}
          <div
            id="text-toolbar-portal"
            className="absolute top-4 left-1/2 z-50 w-max -translate-x-1/2"
          />

          {isFloatingToolbarVisible && (
            <FloatingToolbar
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              openToolboxTab={setToolboxTab}
            />
          )}

          {/*
            The Frame must be mounted before the loader deserializes into it:
            Craft.js seeds its state from the Frame's children on mount, so
            rendering the Frame *after* a deserialize would discard the loaded
            document. The loading state is therefore an overlay, not a swap.
          */}
          <EditorCanvas activeTool={activeTool}>
            <Frame>
              <Element is={DocumentContainer} canvas />
            </Frame>
          </EditorCanvas>

          {loading ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-50/80 text-sm text-slate-500">
              Loading workspace…
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
