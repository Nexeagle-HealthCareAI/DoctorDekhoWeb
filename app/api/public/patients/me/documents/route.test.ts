// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const upstream = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => ({ value: "valid-token" }) }) }));
vi.mock("@/lib/api/server", () => ({ easyhmsFetch: upstream.fetch, isConfigured: () => true }));

import { GET } from "./route";

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/public/patients/me/documents${qs}`));
const calledWith = () => upstream.fetch.mock.calls[0][0] as string;

beforeEach(() => {
  vi.clearAllMocks();
  upstream.fetch.mockResolvedValue({ ok: true, status: 200, data: { success: true, documents: [] }, notConfigured: false });
});

describe("GET /api/public/patients/me/documents: whose records are asked for", () => {
  it("asks the API for everyone's records when all=true (the Everyone tab)", async () => {
    await get("?all=true");
    expect(calledWith()).toBe("/public/patients/me/documents?all=true");
  });

  it("asks for one family member's records when memberId is given", async () => {
    await get("?memberId=abc-123");
    expect(calledWith()).toBe("/public/patients/me/documents?memberId=abc-123");
  });

  it("asks for the account holder's own records by default (the Me tab)", async () => {
    await get("");
    expect(calledWith()).toBe("/public/patients/me/documents");
  });

  it("only treats the exact value 'true' as everyone", async () => {
    await get("?all=1");
    expect(calledWith()).toBe("/public/patients/me/documents");
  });
});
