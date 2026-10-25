// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const upstream = vi.fn();
vi.mock("@/lib/api/server", () => ({ easyhmsFetch: (...a: unknown[]) => upstream(...a) }));

import { POST } from "./route";

const ID = "abcdef12-3456-7890-abcd-ef1234567890";
const post = (body: unknown, id = ID) =>
  POST(new NextRequest(`http://dd.test/api/public/appointments/${id}/checkin`, { method: "POST", body: JSON.stringify(body) }), { params: { id } });

beforeEach(() => {
  upstream.mockReset();
  upstream.mockResolvedValue({ ok: true, status: 200, notConfigured: false, data: { success: true, tokenNo: 7 } });
});

describe("/api/public/appointments/{id}/checkin", () => {
  it("passes the location to 1HMS's check-in", async () => {
    expect((await post({ lat: 22.58, lng: 88.42 })).status).toBe(200);
    expect(upstream).toHaveBeenCalledWith("/public/tokens", expect.objectContaining({
      method: "POST", body: JSON.stringify({ appointmentId: ID, latitude: 22.58, longitude: 88.42 }) }));
  });

  it("refuses a bad id or location without calling 1HMS", async () => {
    expect((await post({ lat: 22.58, lng: 88.42 }, "x")).status).toBe(404);
    expect((await post({ lat: 200, lng: 88.42 })).status).toBe(400);
    expect((await post({ lat: 22.58 })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("passes on 1HMS's refusal", async () => {
    upstream.mockResolvedValueOnce({ ok: false, status: 400, notConfigured: false, data: { success: false, message: "You don't appear to be at the hospital yet." } });
    const res = await post({ lat: 22.9, lng: 88.9 });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/at the hospital/);
  });
});
