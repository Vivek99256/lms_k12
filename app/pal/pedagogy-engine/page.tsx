import PedagogyEngine from './_components/PedagogyEngine';

export const metadata = {
  title: 'Pedagogy Engine | PAL',
};

/**
 * PAL > Pedagogy Engine.
 *
 * All content is served by the backend (GET /api/pal/pedagogy-engine via the
 * same-origin proxy at /api/pal/pedagogy-engine); the client component owns the
 * loading, empty, error and retry states plus submodule selection.
 */
export default function PalPedagogyEnginePage() {
  return <PedagogyEngine />;
}
