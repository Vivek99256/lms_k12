import { ClipboardCheck, GraduationCap } from 'lucide-react';

export function Alignment() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <GraduationCap className="size-4 text-primary" />
          Plans matched to ambition
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Career alignment refers to young people having educational plans that match their occupational
          ambitions. Misalignment means a student&apos;s educational plan is not aligned with their occupational
          ambition — often confusion about the levels of education or qualifications typically required to reach
          the desired role.
        </p>
      </div>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardCheck className="size-4 text-primary" />
          Why it matters
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Misalignment tends to focus on teenagers who underestimate the level of education required to secure
          their career expectation. Teenage career alignment is significantly associated with higher earnings and
          greater career satisfaction than for those who were misaligned as teenagers.
        </p>
      </div>
    </div>
  );
}
