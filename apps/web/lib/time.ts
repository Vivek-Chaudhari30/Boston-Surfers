/** YYYY-MM-DD in Boston time (the daily leaderboard's day boundary). */
export function bostonDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** UTC instants bounding a Boston calendar day (handles DST by probing offsets). */
export function bostonDayRange(day: string): { start: Date; end: Date } {
  const offsetAt = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value; // e.g. "GMT-5"
    const m = /GMT([+-]\d+)/.exec(parts ?? '');
    return m ? Number(m[1]) : -5;
  };
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const off = offsetAt(noonUtc);
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - off * 3600_000);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end };
}
