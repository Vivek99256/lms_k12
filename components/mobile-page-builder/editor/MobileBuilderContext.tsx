'use client';

import React, { createContext, useContext, useMemo } from 'react';

export type MobileBuilderContextValue = {
  pageId: number;
  /** Uploads a background/image file for the current page, returns its public URL. */
  uploadAsset: (file: File) => Promise<string>;
};

const MobileBuilderContext = createContext<MobileBuilderContextValue | null>(null);

/**
 * Gives a block deep inside the Craft.js tree (e.g. ImageBlockSettings'
 * upload button) access to app-level things Craft.js's own node props don't
 * carry -- which page it belongs to, and how to upload a file for it. Craft
 * node state only ever holds what gets persisted in layout_json; the page id
 * and the upload call are deliberately kept outside it.
 */
export function MobileBuilderProvider({
  pageId,
  uploadAsset,
  children,
}: MobileBuilderContextValue & { children: React.ReactNode }) {
  const value = useMemo(() => ({ pageId, uploadAsset }), [pageId, uploadAsset]);
  return <MobileBuilderContext.Provider value={value}>{children}</MobileBuilderContext.Provider>;
}

export function useMobileBuilderContext(): MobileBuilderContextValue {
  const context = useContext(MobileBuilderContext);
  if (!context) {
    throw new Error('useMobileBuilderContext must be used within MobileBuilderProvider');
  }
  return context;
}
