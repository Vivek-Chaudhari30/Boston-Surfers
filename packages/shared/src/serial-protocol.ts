/**
 * Kiosk ↔ Arduino serial protocol v1 (ARCHITECTURE §5).
 * CONTRACT: frozen after hour 1. firmware/dispenser/dispenser.ino mirrors these strings exactly.
 *
 * Link: 115200 baud, 8N1, ASCII lines terminated by '\n' (ignore '\r'), ≤ 32 chars per line.
 */
export const SERIAL = {
  BAUD_RATE: 115200,
  DATA_BITS: 8,
  STOP_BITS: 1,
  PARITY: 'none',
  LINE_END: '\n',
  MAX_LINE_LENGTH: 32,
  PROTOCOL_VERSION: 1,
  /** Full boot banner the sketch prints once. */
  READY_BANNER: 'READY cb-dispenser v1',
} as const;

export const SERIAL_TIMEOUTS = {
  /** Host waits this long for READY after opening the port (the Uno resets on open). */
  READY_MS: 3000,
  /** Heartbeat interval while idle. */
  PING_INTERVAL_MS: 5000,
  /** Missed PONGs before the host marks the dispenser disconnected. */
  MAX_MISSED_PONGS: 2,
  /** dispense(id) fails if DONE does not arrive within this. */
  DISPENSE_MS: 4000,
  /** Number of retries (same id) after a failed/timed-out dispense. */
  DISPENSE_RETRIES: 1,
  /** Optional IR sensor: no drop seen within this → ERR <id> NODROP. */
  NODROP_MS: 1500,
} as const;

/** Dispense id: 1–12 chars of [A-Za-z0-9]. */
export const DISPENSE_ID_PATTERN = /^[A-Za-z0-9]{1,12}$/;

export function isValidDispenseId(id: string): boolean {
  return DISPENSE_ID_PATTERN.test(id);
}

/** Host → Arduino commands. Each returns the line WITHOUT the trailing '\n'. */
export const CMD = {
  ping: () => 'PING',
  status: () => 'STATUS',
  dispense: (id: string) => {
    if (!isValidDispenseId(id)) throw new Error(`invalid dispense id: ${id}`);
    return `DISPENSE ${id}`;
  },
  servo: (deg: number) => {
    const d = Math.round(deg);
    if (!Number.isFinite(d) || d < 0 || d > 180) throw new Error(`invalid servo angle: ${deg}`);
    return `SERVO ${d}`;
  },
} as const;

export type ErrReason = 'BUSY' | 'NODROP' | 'BADCMD' | (string & {});

/** Parsed Arduino → host line. */
export type SerialMessage =
  | { type: 'READY'; name: string; version: number; raw: string }
  | { type: 'PONG'; raw: string }
  | { type: 'ACK'; id: string; raw: string }
  | { type: 'DONE'; id: string; raw: string }
  | { type: 'ERR'; id: string; reason: ErrReason; raw: string }
  | { type: 'STATUS'; state: 'idle' | 'busy'; count: number | null; raw: string }
  | { type: 'OK_SERVO'; deg: number; raw: string }
  | { type: 'BTN'; raw: string }
  | { type: 'UNKNOWN'; raw: string };

/**
 * Parse one line from the Arduino. Strips '\r' and surrounding whitespace.
 * Returns null for empty lines.
 */
export function parseLine(input: string): SerialMessage | null {
  const raw = input.replace(/\r/g, '').trim();
  if (raw === '') return null;
  const parts = raw.split(/\s+/);
  const head = parts[0];

  switch (head) {
    case 'READY': {
      const name = parts[1] ?? '';
      const vMatch = /^v(\d+)$/.exec(parts[2] ?? '');
      return { type: 'READY', name, version: vMatch ? Number(vMatch[1]) : 0, raw };
    }
    case 'PONG':
      return { type: 'PONG', raw };
    case 'ACK':
      return parts[1] ? { type: 'ACK', id: parts[1], raw } : { type: 'UNKNOWN', raw };
    case 'DONE':
      return parts[1] ? { type: 'DONE', id: parts[1], raw } : { type: 'UNKNOWN', raw };
    case 'ERR':
      // 'ERR <id> <REASON>' — id is '-' for BADCMD.
      return { type: 'ERR', id: parts[1] ?? '-', reason: parts[2] ?? 'UNKNOWN', raw };
    case 'STATUS': {
      const state = parts[1] === 'busy' ? 'busy' : 'idle';
      const countPart = parts.find((p) => p.startsWith('count='));
      const count = countPart ? Number(countPart.slice('count='.length)) : null;
      return { type: 'STATUS', state, count: Number.isFinite(count) ? count : null, raw };
    }
    case 'OK':
      if (parts[1] === 'SERVO' && parts[2] !== undefined && Number.isFinite(Number(parts[2]))) {
        return { type: 'OK_SERVO', deg: Number(parts[2]), raw };
      }
      return { type: 'UNKNOWN', raw };
    case 'BTN':
      return { type: 'BTN', raw };
    default:
      return { type: 'UNKNOWN', raw };
  }
}
