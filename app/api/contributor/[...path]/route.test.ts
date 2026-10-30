// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const callUpstream = vi.fn();
vi.mock("@/lib/contributor/upstream", async () => ({
  ALLOWED_SEGMENTS: ["invite", "enrol", "otp", "logout", "register", "me", "articles", "images", "topics", "sso", "profile-tag", "session-from-patient"],
  isUpstreamConfigured: () => true,
  callUpstream: (...a: unknown[]) => callUpstream(...a),
}));

import { GET, POST } from "./route";

const req = (method: string, path: string, body?: unknown, cookie?: string) =>
  new NextRequest(`http://localhost/api/contributor/${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: cookie ? { cookie: `hw_contributor=${cookie}` } : {},
  });
const ctx = (path: string) => ({ params: { path: path.split("/") } });

beforeEach(() => {
  callUpstream.mockReset();
  delete process.env.CONTRIBUTOR_MOCK;
});

describe("contributor proxy", () => {
  it("keeps the session token in an HttpOnly cookie and hides it from the page", async () => {
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { success: true, sessionToken: "tok-123", sessionExpiresAt: "2030-01-01T00:00:00Z", needsRegistration: true } });
    const res = await POST(req("POST", "otp/verify", { mobile: "9876543210", code: "123456" }), ctx("otp/verify"));
    const body = await res.json();
    expect(body).toEqual({ signedIn: true, needsRegistration: true });
    expect(JSON.stringify(body)).not.toContain("tok-123");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("hw_contributor=tok-123");
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("signs a hospital doctor in from EasyHMS with the one-time code, keeping the token in the cookie", async () => {
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { success: true, sessionToken: "tok-sso", sessionExpiresAt: "2030-01-01T00:00:00Z", needsRegistration: false } });
    const res = await POST(req("POST", "sso/exchange", { code: "one-time" }), ctx("sso/exchange"));
    const body = await res.json();
    expect(body).toEqual({ signedIn: true, needsRegistration: false });
    expect(JSON.stringify(body)).not.toContain("tok-sso");
    expect(res.headers.get("set-cookie") ?? "").toContain("hw_contributor=tok-sso");
    expect(callUpstream).toHaveBeenCalledWith("sso/exchange", expect.objectContaining({ method: "POST" }));
  });

  it("answers a spent or expired code with the API's message and sets no cookie", async () => {
    callUpstream.mockResolvedValue({ status: 401, retryAfter: null, data: { message: "This link has expired." } });
    const res = await POST(req("POST", "sso/exchange", { code: "old" }), ctx("sso/exchange"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "This link has expired." });
    expect(res.headers.get("set-cookie") ?? "").not.toContain("hw_contributor=old");
  });

  it("passes the code on when the development API returns it, and never invents one", async () => {
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { success: true, sent: true, devCode: "482913" } });
    const withCode = await POST(req("POST", "otp/send", { mobile: "9876543210" }), ctx("otp/send"));
    expect(await withCode.json()).toEqual({ sent: true, devCode: "482913" });
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { success: true, sent: true, devCode: null } });
    const without = await POST(req("POST", "otp/send", { mobile: "9876543210" }), ctx("otp/send"));
    expect(await without.json()).toEqual({ sent: true });
  });

  it("sends the cookie upstream as the session and returns the data", async () => {
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { id: "c1", fullName: "Dr A" } });
    const res = await GET(req("GET", "me", undefined, "tok-abc"), ctx("me"));
    expect(await res.json()).toEqual({ id: "c1", fullName: "Dr A" });
    expect(callUpstream).toHaveBeenCalledWith("me", expect.objectContaining({ method: "GET", sessionToken: "tok-abc" }));
  });

  it("clears the cookie when the backend says the session is no longer valid", async () => {
    callUpstream.mockResolvedValue({ status: 401, retryAfter: null, data: { message: "Please sign in." } });
    const res = await GET(req("GET", "articles", undefined, "old"), ctx("articles"));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie") ?? "").toContain("hw_contributor=;");
  });

  it("passes the backend's message and wait time on a throttled code request", async () => {
    callUpstream.mockResolvedValue({ status: 429, retryAfter: "42", data: { message: "Please wait before asking for another code.", retryAfterSeconds: 42 } });
    const res = await POST(req("POST", "otp/send", { mobile: "9876543210" }), ctx("otp/send"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await res.json()).toMatchObject({ message: expect.stringContaining("wait"), retryAfterSeconds: 42 });
  });

  it("never forwards a path that is not one of the contributor routes", async () => {
    const res = await GET(req("GET", "internal/secret"), ctx("internal/secret"));
    expect(res.status).toBe(404);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("answers 502 when the backend cannot be reached", async () => {
    callUpstream.mockResolvedValue({ status: 0, retryAfter: null, data: null });
    const res = await GET(req("GET", "me", undefined, "t"), ctx("me"));
    expect(res.status).toBe(502);
  });

  it("signs out upstream and removes the cookie", async () => {
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { ok: true } });
    const res = await POST(req("POST", "logout", undefined, "t"), ctx("logout"));
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie") ?? "").toContain("hw_contributor=;");
  });
});

describe("contributor proxy: the patient's profile page", () => {
  const withPatient = (method: string, path: string) =>
    new NextRequest(`http://localhost/api/contributor/${path}`, { method, headers: { cookie: "nexeagle_patient_session=pat-jwt" } });

  it("asks as the signed-in patient and returns the tag", async () => {
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { isContributor: true, role: "WRITER", status: "PENDING", fullName: "Rohan" } });
    const res = await GET(withPatient("GET", "profile-tag"), ctx("profile-tag"));
    expect((await res.json()).isContributor).toBe(true);
    expect(callUpstream).toHaveBeenCalledWith("profile-tag", expect.objectContaining({ patientToken: "pat-jwt" }));
  });

  it("answers 401 without a patient login and never calls the API", async () => {
    const res = await GET(req("GET", "profile-tag"), ctx("profile-tag"));
    expect(res.status).toBe(401);
    expect(callUpstream).not.toHaveBeenCalled();
  });

  it("opens the contributor area: token goes in the cookie, not the page", async () => {
    callUpstream.mockResolvedValue({ status: 200, retryAfter: null, data: { success: true, sessionToken: "tok-prof", sessionExpiresAt: "2030-01-01T00:00:00Z", needsRegistration: false } });
    const res = await POST(withPatient("POST", "session-from-patient"), ctx("session-from-patient"));
    const body = await res.json();
    expect(body).toEqual({ signedIn: true, needsRegistration: false });
    expect(JSON.stringify(body)).not.toContain("tok-prof");
    expect(res.headers.get("set-cookie") ?? "").toContain("hw_contributor=tok-prof");
  });

  it("does not drop the contributor cookie when the patient login is what failed", async () => {
    callUpstream.mockResolvedValue({ status: 401, retryAfter: null, data: { message: "Please log in again." } });
    const res = await GET(withPatient("GET", "profile-tag"), ctx("profile-tag"));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("hw_contributor");
  });
});
