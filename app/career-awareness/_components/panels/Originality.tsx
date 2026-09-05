import { Lightbulb, Sparkles } from 'lucide-react';

export function Originality() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Lightbulb className="size-4 text-primary" />
          Thinking beyond the obvious choice
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Career originality refers to how original a student&apos;s career expectations are. Students with more
          original career aspirations are likely to have given greater thought to their plans for the future —
          career originality can be a sign of greater critical reflection and career maturity.
        </p>
      </div>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          Exploring vocational pathways
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Career originality is characterised by high levels of teenage participation in vocational education and
          training programmes, which may help explain a greater variety of career interests. Teenagers anticipating
          such programmes can be expected to have received support from their schools in exploring the labour
          market prior to key decision-making.
        </p>
      </div>
    </div>
  );
}
