import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }), usePathname: () => "/profile", useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/patient/PatientTopBar", () => ({ default: () => <div /> }));
vi.mock("@/hooks/usePatientAuth", () => ({ usePatientAuth: () => ({ isLoggedIn: true, mobile: "9876543210", isLoading: false, logout: { mutate: vi.fn(), isPending: false } }) }));
vi.mock("@/lib/contributor/session", () => ({ CONTRIBUTOR_ENABLED: true }));

import ProfileClient from "./ProfileClient";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProfileClient />
    </QueryClientProvider>,
  );

describe("Profile: Health Wiki", () => {
  it("shows the contributor tag and a way into the contributor area for a contributor", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ isContributor: true, role: "INDEPENDENT_DOCTOR", status: "VERIFIED" }) });
    renderPage();
    expect(await screen.findByText("Health Wiki contributor")).toBeInTheDocument();
    expect(screen.getByText(/Independent doctor · Verified/)).toBeInTheDocument();
    expect(screen.getByText("My Health Wiki articles")).toBeInTheDocument();
    expect(screen.queryByText("Write for the Health Wiki")).toBeNull();
    expect(screen.getByRole("link", { name: /Doctor-reviewed health guides/ })).toHaveAttribute("href", "/health");
  });

  it("says the profile is under review for a contributor who is not verified yet", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ isContributor: true, role: "WRITER", status: "PENDING" }) });
    renderPage();
    expect(await screen.findByText(/Writer \/ technologist · Under review/)).toBeInTheDocument();
  });

  it("offers joining to someone who is not a contributor, and shows no tag", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ isContributor: false }) });
    renderPage();
    expect(await screen.findByText("Write for the Health Wiki")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Write for the Health Wiki/ })).toHaveAttribute("href", "/contribute/join");
    expect(screen.queryByText("Health Wiki contributor")).toBeNull();
  });

  it("works the same when the tag cannot be read", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("Write for the Health Wiki")).toBeInTheDocument();
    expect(screen.getByText("Personal Information")).toBeInTheDocument();
  });

  it("opens the contributor area without a second code", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("profile-tag")
        ? { ok: true, json: async () => ({ isContributor: true, role: "WRITER", status: "VERIFIED" }) }
        : { ok: true, json: async () => ({ signedIn: true, needsRegistration: false }) });
    renderPage();
    await userEvent.click(await screen.findByText("My Health Wiki articles"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/contribute"));
    expect(fetchMock).toHaveBeenCalledWith("/api/contributor/session-from-patient", expect.objectContaining({ method: "POST" }));
  });
});
