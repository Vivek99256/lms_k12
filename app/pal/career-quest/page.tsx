import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CareerQuestIndexPage() {
  return redirect('/pal/career-quest/explorer');
}
