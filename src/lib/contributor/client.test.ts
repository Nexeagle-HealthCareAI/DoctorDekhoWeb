import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body });
const unauthorised = () => ({ ok: false, status: 401, json: async () => ({ message: "Please sign in again." }) });

// a fresh copy of the module each time: the shared sign-in attempt is remembered for a moment
let ApiError: typeof import("./client").ApiError;
let contributorApi: typeof import("./client").contributorApi;

beforeEach(async () => {
  vi.resetModules();
  ({ ApiError, contributorApi } = await import("./client"));
  vi.useRealTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("contributor calls and the Doctor Dekho login", () => {
  it("signs in from the patient login on a 'sign in' answer and repeats the call, so no second code is asked", async () => {
    fetchMock
      .mockResolvedValueOnce(unauthorised())                       // me: not signed in as a contributor
      .mockResolvedValueOnce(ok({ signedIn: true }))              // session from the patient login
      .mockResolvedValueOnce(ok({ id: "c1", fullName: "Dr. Asha" })); // me again
    const me = await contributorApi.me();
    expect(me).toMatchObject({ id: "c1" });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/contributor/me", "/api/contributor/session-from-patient", "/api/contributor/me",
    ]);
  });

  it("still fails with 401 when there is no usable patient login", async () => {
    fetchMock.mockResolvedValueOnce(unauthorised()).mockResolvedValueOnce(unauthorised()); // me, then the patient attempt
    await expect(contributorApi.me()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries only once per call", async () => {
    fetchMock.mockResolvedValueOnce(unauthorised()).mockResolvedValueOnce(ok()).mockResolvedValueOnce(unauthorised());
    await expect(contributorApi.articles()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not try it for the calls that are about signing in themselves", async () => {
    fetchMock.mockResolvedValue(unauthorised());
    await expect(contributorApi.verifyOtp("9876543210", "123456", {})).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes one attempt when several calls fail at the same moment", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("session-from-patient")) return ok({ signedIn: true });
      return fetchMock.mock.calls.filter((c) => c[0] === url).length > 1 ? ok({}) : unauthorised();
    });
    await Promise.all([contributorApi.me(), contributorApi.articles(), contributorApi.topics()]);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("session-from-patient"))).toHaveLength(1);
  });
});
