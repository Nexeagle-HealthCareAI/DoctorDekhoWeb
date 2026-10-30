// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({ fetch: vi.fn() }));
const jar = vi.hoisted(() => ({ token: "valid-token" as string | undefined }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => (jar.token ? { value: jar.token } : undefined) }) }));
vi.mock("@/lib/api/server", () => ({ easyhmsFetch: upstream.fetch }));

import { GET as mine } from "./route";
import { GET as me } from "../../patients/me/route";
import { PATIENT_SESSION_COOKIE } from "@/lib/api/patientSession";
import { NextRequest } from "next/server";

const req = () => new NextRequest("http://localhost/x");
const clearsCookie = (res: Response) => (res.headers.get("set-cookie") ?? "").includes(`${PATIENT_SESSION_COOKIE}=;`);

beforeEach(() => {
  vi.clearAllMocks();
  jar.token = "valid-token";
});

describe.each([
  ["appointments/mine", mine],
  ["patients/me", me],
])("%s: when does the patient stay signed in?", (_name, handler) => {
  it("is signed out (cookie cleared) only when the API says 401", async () => {
    upstream.fetch.mockResolvedValue({ ok: false, status: 401, data: null, notConfigured: false });
    const res = await handler(req());
    expect(res.status).toBe(401);
    expect(clearsCookie(res)).toBe(true);
  });

  it.each([429, 500, 502, 503])("keeps the cookie on a temporary %i from the API", async (status) => {
    upstream.fetch.mockResolvedValue({ ok: false, status, data: null, notConfigured: false });
    const res = await handler(req());
    expect(res.status).toBe(status);
    expect(clearsCookie(res)).toBe(false);
  });

  it("answers 401 without calling the API when there is no cookie", async () => {
    jar.token = undefined;
    const res = await handler(req());
    expect(res.status).toBe(401);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });
});
