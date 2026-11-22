import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), eq: vi.fn(), read: vi.fn() }));
vi.mock('@/lib/session', () => ({ getRiderSession: mocks.session }));
vi.mock('@/lib/db', () => ({ db: () => ({ from: mocks.from }) }));
import { POST } from './route';
import { GET } from '../[code]/status/route';
const row = { id: 'aabb1122-1111-4444-8888-123456789abc', code: 'ABC234', rider_id: 'owner', car_id: 'green-3812', score: 70, expires_at: '2099-01-01T00:00:00Z', redeemed_at: null, dispense_status: null };
const request = () => new Request('http://localhost/api/rewards/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'ABC234', score: 999999, riderId: 'someone-else' }) });
const ctx = () => ({ params: Promise.resolve({ code: 'ABC234' }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ riderId: 'owner' });
  const chain = { select: vi.fn(), eq: mocks.eq, maybeSingle: mocks.read };
  chain.select.mockReturnValue(chain); mocks.eq.mockReturnValue(chain); mocks.read.mockResolvedValue({ data: row, error: null }); mocks.from.mockReturnValue(chain);
});
describe('private ranked reward QR', () => {
  it('requires a rider session before reading claims or statuses', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect((await GET(new Request('http://localhost'), ctx())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not expose another passenger’s claim', async () => {
    mocks.read.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.eq.mock.calls).toContainEqual(['rider_id', 'owner']);
  });
  it('uses only database reward data, ignoring phone-supplied scores and identities', async () => {
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ payload: 'CB1:ABC234', score: 70, reward: { id: 'boston-keepsake' } });
    expect(mocks.eq.mock.calls).toContainEqual(['rider_id', 'owner']);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('reports a reserved claim as processing until the board confirmation is saved', async () => {
    mocks.read.mockResolvedValue({ data: { ...row, redeemed_at: '2026-11-21T23:00:00Z' }, error: null });
    const response = await GET(new Request('http://localhost'), ctx());
    expect(await response.json()).toMatchObject({ state: 'processing' });
    expect(response.headers.get('vary')).toBe('Cookie');
  });
});
