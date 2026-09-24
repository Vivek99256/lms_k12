'use client';

import React from 'react';
import { Layers } from '@craftjs/layers';

/** The component tree for the current page, via @craftjs/layers (already a dependency, used by the document-template editor's own LayersPanel). */
export const MobileLayersPanel = () => {
  return (
    <div className="flex-1 overflow-y-auto p-2 text-sm">
      <Layers />
    </div>
  );
};
