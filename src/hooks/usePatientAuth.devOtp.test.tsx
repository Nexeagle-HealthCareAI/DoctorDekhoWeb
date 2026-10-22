import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { usePatientAuth } from "./usePatientAuth";

const fetchMock = vi.fn();
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

const send = async (otpResponse: Record<string, unknown>) => {
  fetchMock.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => (url.includes("otp/send") ? otpResponse : { loggedIn: false }) }));
  const { result } = renderHook(() => usePatientAuth(), { wrapper });
  await result.current.sendOtp.mutateAsync("9876543210");
  await waitFor(() => expect(result.current.sendOtp.isSuccess).toBe(true));
};

describe("patient OTP on a development server", () => {
  it("shows the code the API hands back", async () => {
    await send({ success: true, message: "ok", devCode: "123456" });
    expect(toast.info).toHaveBeenCalledWith("Dev only: your OTP is 123456", expect.any(Object));
  });

  it("shows nothing when the API sends no code (every other server)", async () => {
    await send({ success: true, message: "An OTP has been sent via WhatsApp." });
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("shows nothing when the send failed", async () => {
    await send({ success: false, message: "Please wait 20s", devCode: "999999" });
    expect(toast.info).not.toHaveBeenCalled();
  });
});
