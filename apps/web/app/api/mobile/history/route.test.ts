import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getRiderSession: mocks.session }));
vi.mock("@/lib/db", () => ({ db: () => ({ from: mocks.from }) }));
import { GET } from "./route";

describe("personal mobile history access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: vi.fn(),
      eq: mocks.eq,
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    query.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(query);
  });
  it("rejects anonymous requests before reading the database", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("filters both runs and reward claims by the signed-in passenger", async () => {
    mocks.session.mockResolvedValue({ riderId: "only-this-rider" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.eq.mock.calls).toEqual([
      ["rider_id", "only-this-rider"],
      ["rider_id", "only-this-rider"],
    ]);
    expect(await response.json()).toEqual({ runs: [], rewards: [] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
});
