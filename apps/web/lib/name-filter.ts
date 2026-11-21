// Server only. Small display-name blocklist for the public boards (case + leetspeak insensitive).
// Matching is per token (split on whitespace/punctuation) so real names such as Harshit or Nigel pass.
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i' };

// Stored reversed so the source stays tame.
// Strong words: blocked even when embedded inside a token (letters may be repeated: "fuuuck").
const EMBEDDED = ['reggin', 'kcuf', 'hctib', 'elohssa', 'tihsllub', 'tihsesroh', 'tihspid', 'tihstab', 'tihsepa'];
// Short or name-colliding words: blocked only when the whole token is the word.
const WHOLE_ONLY = ['ssa', 'kcid', 'yssup', 'tihs', 'regin'];
// Token prefixes (cunty, shitty, shithead) that are safe to block without hitting Shital/Shitij.
const PREFIXES = ['tnuc', 'ttihs', 'daehtihs', 'ecaftihs'];

const rev = (w: string) => [...w].reverse().join('');
const squash = (s: string) => s.replace(/(.)\1+/g, '$1');

/** Regex for a word where each letter may repeat, but doubled letters must stay doubled ("ass" -> a+s{2,}). */
function runRegex(word: string, anchored: 'none' | 'whole' | 'start'): RegExp {
  const body = (word.match(/(.)\1*/g) ?? []).map((run) => (run.length > 1 ? `${run[0]}{${run.length},}` : `${run}+`)).join('');
  return new RegExp(anchored === 'whole' ? `^${body}$` : anchored === 'start' ? `^${body}` : body);
}

const EMBEDDED_RE = EMBEDDED.map((w) => runRegex(rev(w), 'none'));
const WHOLE_RE = WHOLE_ONLY.map((w) => runRegex(rev(w), 'whole'));
const PREFIX_RE = PREFIXES.map((w) => runRegex(rev(w), 'start'));

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9@$!]+/)
    .map((t) => t.replace(/[0134578@$!]/g, (c) => LEET[c] ?? c).replace(/[^a-z]/g, ''))
    .filter(Boolean);
}

/** Lowercased, leetspeak-folded name with word breaks removed (kept for callers that want a single key). */
export function normalizeName(name: string): string {
  return tokens(name).join('');
}

function tokenBad(t: string): boolean {
  const s = squash(t);
  return (
    EMBEDDED_RE.some((re) => re.test(t)) ||
    WHOLE_RE.some((re) => re.test(t)) ||
    PREFIX_RE.some((re) => re.test(t)) ||
    // "niger" (one g) whole token only; Nigeria and Nigel are fine.
    s === 'niger'
  );
}

export function isNameAllowed(name: string): boolean {
  const toks = tokens(name);
  // "f u c k": also test runs of single-letter tokens joined together.
  const cands = [...toks];
  let run = '';
  for (const t of [...toks, '']) {
    if (t.length === 1) run += t;
    else {
      if (run.length > 1) cands.push(run);
      run = '';
    }
  }
  return !cands.some(tokenBad);
}
