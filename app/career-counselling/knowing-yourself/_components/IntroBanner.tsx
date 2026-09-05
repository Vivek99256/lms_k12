'use client';

// Ported from the source app's Yourself/header component — the counselling
// intro banner that sits at the top of the legacy /knowing-yourself route.
export function IntroBanner() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/career-counselling/knowing-yourself/Frame 719.jpg"
        alt=""
        className="h-[120px] w-full object-cover"
      />
      <div className="space-y-4 p-5">
        <p className="mx-auto max-w-3xl text-center text-sm leading-6 text-muted-foreground md:text-base">
          Today, the art of talking therapies such as counselling are used to help people come to
          terms with many problems they are facing, with an ultimate aim of overcoming them.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/career-counselling/knowing-yourself/Frame 467.png"
          alt=""
          className="w-full rounded-lg"
        />
      </div>
    </div>
  );
}
