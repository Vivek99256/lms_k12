import { dissolvingKit } from './dissolving/kit';
import { iceMeltingKit } from './iceMelting/kit';
import type { LabKit } from './types';

export function getKit(simulationId: string): LabKit | null {
  if (simulationId === 'dissolving') return dissolvingKit;
  if (simulationId === 'ice_melting') return iceMeltingKit;
  return null;
}
