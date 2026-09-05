'use client';

import { HeartHandshake } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Native replacement for the source app's Yourself/header banner — same
// message, rebuilt as a design-system card instead of raw legacy imagery.
export function IntroBanner() {
  return (
    <Card className="border-indigo-200 bg-indigo-50/60">
      <CardContent className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[#4F46E5]">
          <HeartHandshake className="size-5" />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Today, the art of talking therapies such as counselling are used to help people come to
          terms with many problems they are facing, with an ultimate aim of overcoming them.
        </p>
      </CardContent>
    </Card>
  );
}
