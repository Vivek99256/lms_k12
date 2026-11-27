import type { ComponentType } from 'react';

export interface LabObjectRendererProps {
  id: string;
  getWorld: () => unknown;
}

/**
 * The 3D side of one lab: a renderer per object kind, the effects that belong
 * to the whole experiment (particles, streams) and the room around it. A new
 * lab ships its own kit and reuses the engine unchanged.
 */
export interface LabKit {
  objects: Record<string, ComponentType<LabObjectRendererProps>>;
  Effects?: ComponentType<{ getWorld: () => unknown }>;
  Environment?: ComponentType;
}
