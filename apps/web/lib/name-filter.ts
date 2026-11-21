// Server only. Small display-name blocklist for the public boards (case + leetspeak insensitive).
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i' };

// Stored reversed so the source stays tame.
const EMBEDDED = ['reggin', 'regin', 'tihs', 'kcuf', 'hctib', 'tnuc', 'elohssa', 'yssup'];
// Short words match only as the whole name (avoids "class", "assist", "dickens").
const WHOLE_ONLY = ['ssa', 'kcid'];

const rev = (w: string) => [...w].reverse().join('');
const squash = (s: string) => s.replace(/(.)\1+/g, '$1');

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '');
}

export function isNameAllowed(name: string): boolean {
  const n = normalizeName(name);
  const s = squash(n);
  const embedded = EMBEDDED.map(rev);
  const whole = WHOLE_ONLY.map(rev);
  if (embedded.some((w) => n.includes(w) || s.includes(squash(w)))) return false;
  if (whole.some((w) => n === w || s === squash(w))) return false;
  return true;
}
