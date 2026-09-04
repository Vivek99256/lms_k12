export default function Loading() {
  return (
    <div className="space-y-4 p-6" aria-label="Loading career intelligence">
      <div className="h-8 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
