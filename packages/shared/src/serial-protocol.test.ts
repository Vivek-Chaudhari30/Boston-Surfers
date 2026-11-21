import { describe, expect, it } from 'vitest';
import { CMD, parseLine, SERIAL } from './serial-protocol';

describe('parseLine', () => {
  it('parses the READY banner and strips \\r', () => {
    expect(parseLine(`${SERIAL.READY_BANNER}\r`)).toMatchObject({ type: 'READY', name: 'cb-dispenser', version: 1 });
  });
  it('parses ACK / DONE / ERR', () => {
    expect(parseLine('ACK ab12')).toMatchObject({ type: 'ACK', id: 'ab12' });
    expect(parseLine('DONE ab12')).toMatchObject({ type: 'DONE', id: 'ab12' });
    expect(parseLine('ERR ab12 BUSY')).toMatchObject({ type: 'ERR', id: 'ab12', reason: 'BUSY' });
    expect(parseLine('ERR - BADCMD')).toMatchObject({ type: 'ERR', id: '-', reason: 'BADCMD' });
  });
  it('parses STATUS, OK SERVO, PONG, BTN', () => {
    expect(parseLine('STATUS idle count=7')).toMatchObject({ type: 'STATUS', state: 'idle', count: 7 });
    expect(parseLine('STATUS busy')).toMatchObject({ type: 'STATUS', state: 'busy', count: null });
    expect(parseLine('OK SERVO 90')).toMatchObject({ type: 'OK_SERVO', deg: 90 });
    expect(parseLine('PONG')).toMatchObject({ type: 'PONG' });
    expect(parseLine('BTN')).toMatchObject({ type: 'BTN' });
  });
  it('returns null for blank lines and UNKNOWN for garbage', () => {
    expect(parseLine('  \r')).toBeNull();
    expect(parseLine('hello')).toMatchObject({ type: 'UNKNOWN' });
  });
});

describe('CMD', () => {
  it('builds commands and rejects bad input', () => {
    expect(CMD.dispense('abc123')).toBe('DISPENSE abc123');
    expect(() => CMD.dispense('bad id!')).toThrow();
    expect(() => CMD.dispense('x'.repeat(13))).toThrow();
    expect(CMD.servo(45.4)).toBe('SERVO 45');
    expect(() => CMD.servo(200)).toThrow();
  });
});
