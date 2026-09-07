import { BadgeCheck, Compass, Lightbulb, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Certainty } from './panels/Certainty';
import { Ambition } from './panels/Ambition';
import { Alignment } from './panels/Alignment';
import { Originality } from './panels/Originality';

export type CareerAwarenessSection = 'certainty' | 'ambition' | 'alignment' | 'originality';

const SECTION_CONFIG: Record<
  CareerAwarenessSection,
  { title: string; description: string; icon: LucideIcon; Panel: () => React.JSX.Element }
> = {
  certainty: {
    title: 'Career certainty',
    description: 'Name and investigate an occupation you may want at age 30.',
    icon: Target,
    Panel: Certainty,
  },
  ambition: {
    title: 'Career ambition',
    description: 'Connect your interests and strengths to a professional or managerial goal.',
    icon: Sparkles,
    Panel: Ambition,
  },
  alignment: {
    title: 'Career alignment',
    description: 'Check that your educational plan matches your career goal.',
    icon: Compass,
    Panel: Alignment,
  },
  originality: {
    title: 'Career originality',
    description: 'Challenge assumptions and explore pathways beyond the obvious choice.',
    icon: Lightbulb,
    Panel: Originality,
  },
};

export function CareerAwarenessSectionHub({ section }: { section: CareerAwarenessSection }) {
  const { title, description, icon: Icon, Panel } = SECTION_CONFIG[section];

  return (
    <div className="space-y-5 p-1 md:p-2">
      <header className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Compass className="size-4" />
              Career awareness
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant="secondary">
            <BadgeCheck />
            Self-discovery
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-4" />
            Why it matters
          </CardTitle>
          <CardDescription>Background on {title.toLowerCase()}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Panel />
        </CardContent>
      </Card>
    </div>
  );
}
