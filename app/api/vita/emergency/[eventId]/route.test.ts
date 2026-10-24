// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const upstream = vi.fn();
vi.mock("@/lib/api/server", () => ({ easyhmsFetch: (...a: unknown[]) => upstream(...a) }));

import { POST } from "./route";
import { cleanMobile } from "@/lib/vita/emergency";

const EVENT = "e0000000-0000-0000-0000-000000000001";
const SETTING = "5e771000-0000-0000-0000-000000000001";
const post = (body: unknown, eventId = EVENT) =>
  POST(new NextRequest(`http://dd.test/api/vita/emergency/${eventId}`, { method: "POST", body: JSON.stringify(body) }), { params: { eventId } });

beforeEach(() => {
  upstream.mockReset();
  upstream.mockResolvedValue({ ok: true, status: 200, notConfigured: false, data: { success: true } });
});

describe("/api/vita/emergency/{eventId}", () => {
  it("logs a call tap against the emergency", async () => {
    expect((await post({ action: "call", settingId: SETTING })).status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(`/public/emergency-alerts/${EVENT}/call`, expect.objectContaining({ body: JSON.stringify({ settingId: SETTING }) }));
  });

  it("shares a number only with consent, cleaned to 10 digits", async () => {
    expect((await post({ action: "share", mobile: "9876543210" })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
    expect((await post({ action: "share", mobile: "12345", consent: true })).status).toBe(400);
    const ok = await post({ action: "share", mobile: "+91 98765 43210", consent: true });
    expect(ok.status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(`/public/emergency-alerts/${EVENT}/share-number`,
      expect.objectContaining({ body: JSON.stringify({ mobile: "9876543210", consent: true }) }));
  });

  it("passes on a refusal and a rate limit", async () => {
    upstream.mockResolvedValueOnce({ ok: false, status: 400, notConfigured: false, data: { success: false, message: "too old" } });
    expect(await (await post({ action: "share", mobile: "9876543210", consent: true })).json()).toEqual({ error: "refused", message: "too old" });
    upstream.mockResolvedValueOnce({ ok: false, status: 429, notConfigured: false, data: null });
    expect((await post({ action: "share", mobile: "9876543210", consent: true })).status).toBe(429);
  });

  it("rejects anything else without calling 1HMS", async () => {
    expect((await post({ action: "call", settingId: SETTING }, "not-a-guid")).status).toBe(400);
    expect((await post({ action: "call", settingId: "x" })).status).toBe(400);
    expect((await post({ action: "book" })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("cleans Indian mobile numbers", () => {
    expect(cleanMobile("098765 43210")).toBe("9876543210");
    expect(cleanMobile("919876543210")).toBe("9876543210");
    expect(cleanMobile("5876543210")).toBeNull();
    expect(cleanMobile(42)).toBeNull();
  });
});
