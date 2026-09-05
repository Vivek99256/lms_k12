import { Compass, Target } from 'lucide-react';

export function Ambition() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Expecting professional or managerial employment by age 30
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Career ambition — the expectation of working in a job classified as managerial or professional — is
          associated with higher earnings, reduced unemployment, and greater career satisfaction, even after
          controlling for background variables.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Compass className="size-4 text-primary" />
            Understand yourself
          </h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Reflect on your passions, strengths, and values. Identifying these helps guide you toward a career
            that keeps you motivated and fulfilled.
          </p>
        </div>
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target className="size-4 text-primary" />
            Establish objectives
          </h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Define achievable, specific goals — such as earning a promotion or acquiring a new skill. Clear goals
            provide direction and keep you motivated toward your ambitions.
          </p>
        </div>
      </div>
    </div>
  );
}
