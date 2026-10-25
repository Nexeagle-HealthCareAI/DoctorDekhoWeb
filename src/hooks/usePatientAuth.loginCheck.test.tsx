import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { usePatientAuth } from "./usePatientAuth";

const fetchMock = vi.fn();
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
const busy = () => ({ ok: false, status: 429, headers: new Headers({ "Retry-After": "0.01" }), json: async () => ({ loggedIn: false }) });
const signedIn = () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ loggedIn: true, mobile: "9876543210", appointments: [] }) });

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

describe("the login check", () => {
  it("asks again after a busy moment and never shows a signed-in person as signed out meanwhile", async () => {
    fetchMock.mockImplementationOnce(async () => busy()).mockImplementationOnce(async () => busy()).mockImplementation(async () => signedIn());
    const { result } = renderHook(() => usePatientAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.loginCheckFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("says the check failed, not that the person is signed out, when the answer never comes", async () => {
    fetchMock.mockImplementation(async () => busy());
    const { result } = renderHook(() => usePatientAuth(), { wrapper });
    await waitFor(() => expect(result.current.loginCheckFailed).toBe(true), { timeout: 5000 });
    expect(result.current.isLoggedIn).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4); // the first try and three more
  });

  it("does not retry a plain 'not logged in'", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 401, headers: new Headers(), json: async () => ({ loggedIn: false }) }));
    const { result } = renderHook(() => usePatientAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.loginCheckFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
