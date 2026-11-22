import { z } from "zod";

/** Remembered rider details on this phone. Every access is try/catch'd. */
const KEY = "cb_pass_v1";
const OUT = "cb_pass_out";
const Pass = z.object({ displayName: z.string(), phone: z.string() });
export type StoredPass = z.infer<typeof Pass>;

export function readPass(): StoredPass | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = Pass.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writePass(pass: StoredPass) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pass));
    localStorage.removeItem(OUT);
  } catch {
    /* works without storage */
  }
}

/** "Not you?" on this phone: forget details and ignore the leftover cookie until the next sign-in. */
export function clearPass() {
  try {
    localStorage.removeItem(KEY);
    localStorage.setItem(OUT, "1");
  } catch {
    /* ignore */
  }
}

export function isSignedOutHere(): boolean {
  try {
    return localStorage.getItem(OUT) === "1";
  } catch {
    return false;
  }
}
