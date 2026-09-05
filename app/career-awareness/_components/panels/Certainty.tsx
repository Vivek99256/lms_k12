import { BadgeCheck, TrendingUp } from 'lucide-react';

export function Certainty() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BadgeCheck className="size-4 text-primary" />
          Aim &amp; objective
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          We are developing career guidance, coaching, and counselling for K-12 students — from grade 8 onward,
          students build knowledge about their career. Careers play an important role in an individual&apos;s life;
          detailed knowledge helps them plan well in advance.
        </p>
      </div>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="size-4 text-primary" />
          Why career certainty matters
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Career certainty is the ability to name a job expected at age 30 — articulating, as a teenager, an
          occupational ambition or career expectation for adult life. It does not require the expectation to be
          fixed, only that the student has a view on the type of job they envision in adulthood. Teenage career
          certainty is significantly associated with higher earnings than for those who were uncertain as
          teenagers.
        </p>
      </div>
    </div>
  );
}
