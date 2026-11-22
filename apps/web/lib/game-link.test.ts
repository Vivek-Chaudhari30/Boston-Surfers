import { describe, expect, it } from 'vitest';
import { gameLink } from './game-link';

describe('phone game link', () => {
  it('replaces kiosk localhost with its LAN address and keeps the preview port', () => {
    expect(gameLink('http://127.0.0.1:3001', '192.168.1.40')).toEqual({ url: 'http://192.168.1.40:3001/dev/game', local: true });
    expect(gameLink('http://localhost:3000', '10.1.2.3')?.url).toBe('http://10.1.2.3:3000/dev/game');
    expect(gameLink('http://[::1]:3001', '10.1.2.3')?.url).toBe('http://10.1.2.3:3001/dev/game');
    expect(gameLink('http://0.0.0.0:3001', '10.1.2.3')?.url).toBe('http://10.1.2.3:3001/dev/game');
  });
  it('uses the deployed origin without leaking a kiosk LAN address or query parameters', () => {
    expect(gameLink('https://boston.example/?key=secret', '10.1.2.3')).toEqual({ url: 'https://boston.example/dev/game', local: false });
    expect(gameLink('http://192.168.1.40:3001')?.local).toBe(true);
  });
  it('does not generate an unscannable localhost QR without Wi-Fi', () => {
    expect(gameLink('http://localhost:3001')).toBeNull();
    expect(() => gameLink('javascript:alert(1)')).toThrow();
  });
});
