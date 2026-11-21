/** Shift a YYYY-MM-DD day by `delta` days (calendar math in UTC, so DST-safe). */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** A valid real calendar day not after `today`, else `today`. */
export function parseDay(raw: string | undefined, today: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw > today) return today;
  try {
    const d = new Date(`${raw}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return today;
  } catch {
    return today;
  }
  return raw;
}
