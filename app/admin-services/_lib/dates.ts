/** Local-time ISO helpers shared by the Admin services date filters. */

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function monthStartIso(): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Renders a `Y-m-d` / `d-m-Y` value in the viewer's locale, leaving junk as-is. */
export function formatDisplayDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const dmy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : trimmed;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}
