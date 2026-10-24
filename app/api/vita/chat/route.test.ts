// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const fetchMock = vi.fn();
let route: typeof import("./route");

async function load(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.stubGlobal("fetch", fetchMock);
  route = await import("./route");
}

const post = (body: unknown, ip = "1.2.3.4") =>
  route.POST(new NextRequest("http://dd.test/api/vita/chat", {
    method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip },
  }));

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

describe("/api/vita/chat", () => {
  it("is off without a router address, and says so to the widget", async () => {
    await load({ NLP_ROUTER_BASE_URL: "" });
    expect(await (await route.GET()).json()).toEqual({ enabled: false });
    expect((await post({ text: "hi" })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is on only when the router can really serve Vita", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const probe = async (status: number, body: string) => {
      await load({ NLP_ROUTER_BASE_URL: "http://router", NLP_ROUTER_API_KEY: "k" });
      fetchMock.mockResolvedValueOnce(new Response(body, { status }));
      return (await (await route.GET()).json()).enabled;
    };
    expect(await probe(404, JSON.stringify({ detail: "Session 'vita-readiness-check' not found or has expired" }))).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("http://router/v2/agent/session/vita-readiness-check");
    expect(await probe(404, JSON.stringify({ detail: "Not Found" }))).toBe(false);   // Vita not deployed yet
    expect(await probe(403, "{}")).toBe(false);                                       // key without the chat scope
    expect(await probe(401, "{}")).toBe(false);
  });

  it("remembers the router check for a few minutes", async () => {
    await load({ NLP_ROUTER_BASE_URL: "http://router" });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "Session 'x' not found" }), { status: 404 }));
    await route.GET();
    await route.GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("can be switched off at runtime", async () => {
    await load({ NLP_ROUTER_BASE_URL: "http://router", VITA_CHAT_ENABLED: "0" });
    expect(await (await route.GET()).json()).toEqual({ enabled: false });
  });

  it("forwards only the contract's fields, with the server-side key", async () => {
    await load({ NLP_ROUTER_BASE_URL: "http://router/", NLP_ROUTER_API_KEY: "secret" });
    fetchMock.mockResolvedValue(json({ kind: "doctor_list", session_id: "s1", message: "ok" }));
    const res = await post({
      text: "  skin ka doctor  ", session_id: "s1", city: "Kolkata", lat: 22.5, lng: 88.4, page: 2, new_search: true,
      select_doctor_id: "00000000-0000-0000-0000-000000000001", hospital_id: "not-a-uuid", evil: "x",
    });
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://router/v2/agent/chat");
    expect(init.headers["X-Api-Key"]).toBe("secret");
    expect(JSON.parse(init.body)).toEqual({
      text: "skin ka doctor", session_id: "s1", city: "Kolkata", lat: 22.5, lng: 88.4, page: 2, new_search: true,
      select_doctor_id: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("drops a location that is out of range or half given", async () => {
    await load({ NLP_ROUTER_BASE_URL: "http://router" });
    fetchMock.mockResolvedValue(json({}));
    await post({ text: "near me", lat: 95, lng: 88 });
    await post({ text: "near me", lat: 22 });
    for (const call of fetchMock.mock.calls) expect(JSON.parse(call[1].body)).toEqual({ text: "near me" });
  });

  it("rejects empty or too long text without calling the router", async () => {
    await load({ NLP_ROUTER_BASE_URL: "http://router" });
    expect((await post({ text: "   " })).status).toBe(400);
    expect((await post({ text: "x".repeat(1001) })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes a 422 (doctor not shown in this session) and hides other router failures", async () => {
    await load({ NLP_ROUTER_BASE_URL: "http://router" });
    fetchMock.mockResolvedValueOnce(json({ detail: "x" }, 422));
    expect((await post({ text: "Choose" })).status).toBe(422);
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(json({ detail: "boom" }, 500));
    const res = await post({ text: "hi" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "vita_unavailable" });
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect((await post({ text: "hi" })).status).toBe(502);
  });

  it("limits one visitor without limiting others", async () => {
    await load({ NLP_ROUTER_BASE_URL: "http://router", VITA_VISITOR_LIMIT: "2" });
    fetchMock.mockImplementation(async () => json({}));
    expect((await post({ text: "a" }, "9.9.9.9")).status).toBe(200);
    expect((await post({ text: "b" }, "9.9.9.9")).status).toBe(200);
    expect((await post({ text: "c" }, "9.9.9.9")).status).toBe(429);
    expect((await post({ text: "d" }, "8.8.8.8")).status).toBe(200);
  });
});
