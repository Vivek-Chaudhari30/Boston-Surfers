import { afterEach, expect, it, vi } from "vitest";
import { browserMatrixStatus, playBrowserMatrix } from "./browser-matrix";
afterEach(() => vi.unstubAllGlobals());
it("checks the loopback bridge without sending credentials", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({connected:true,mode:"matrix-only"}));
  vi.stubGlobal("fetch",fetcher);
  await browserMatrixStatus();
  expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8765/api/status",expect.objectContaining({credentials:"omit"}));
});
it("rejects mismatched hardware acknowledgements", async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({ok:true,id:"ffffffffffff",mode:"matrix-only"})));
  await expect(playBrowserMatrix("123456abcdef")).rejects.toThrow("did not match");
});
it("keeps the request id for deduplicated retries", async () => {
  const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,id:"123456abcdef",mode:"matrix-only"}));
  vi.stubGlobal("fetch",fetcher);
  await playBrowserMatrix("123456abcdef");
  expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8765/api/reward",expect.objectContaining({body:'{"id":"123456abcdef"}'}));
});
it("rejects invalid IDs before contacting hardware", async () => {
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  await expect(playBrowserMatrix("bad")).rejects.toThrow("Invalid");
  expect(fetcher).not.toHaveBeenCalled();
});
