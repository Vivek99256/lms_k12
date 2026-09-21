import { redirect } from 'next/navigation';

/**
 * One canonical route per module.
 *
 * The generator emitted this screen twice, once under each of the two real
 * student route trees (`/student/**` and `/students/**`). The registry names
 * `/students/intelligence` as the module's route, so this stays only to keep an
 * already-shared link working, and forwards rather than rendering a second copy
 * of the same contract that would then drift from it.
 */
export default function Page() {
  redirect('/students/intelligence');
}
