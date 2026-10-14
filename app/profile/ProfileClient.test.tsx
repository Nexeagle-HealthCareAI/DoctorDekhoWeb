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
const patientProfile = vi.hoisted(() => ({ fullName: null as string | null }));
vi.mock("@/hooks/usePatientProfile", () => ({ usePatientProfile: () => ({ data: { success: true, fullName: patientProfile.fullName } }) }));

import ProfileClient from "./ProfileClient";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  patientProfile.fullName = null;
  vi.stubGlobal("fetch", fetchMock);
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProfileClient />
    </QueryClientProvider>,
  );

const tagIs = (tag: object) => fetchMock.mockImplementation(async () => ({ ok: true, json: async () => tag }));

describe("Profile: who is signed in", () => {
  it("shows the contributor's name, then the mobile number, then the tag", async () => {
    tagIs({ isContributor: true, role: "INDEPENDENT_DOCTOR", status: "VERIFIED", fullName: "Dr. Asha Rao" });
    renderPage();
    const [name] = await screen.findAllByRole("heading", { name: "Dr. Asha Rao" });
    const mobile = screen.getAllByText("+91 9876543210")[0];
    const tag = screen.getAllByText("Health Wiki contributor")[0];
    // in the page order: name, mobile number, tag
    expect(name.compareDocumentPosition(mobile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mobile.compareDocumentPosition(tag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(/Independent doctor · Verified/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Patient Profile")).toBeNull();
  });

  it("uses the name from the bookings for someone who is not a contributor, and no tag", async () => {
    patientProfile.fullName = "Ravi Kumar";
    tagIs({ isContributor: false });
    renderPage();
    expect((await screen.findAllByRole("heading", { name: "Ravi Kumar" })).length).toBeGreaterThan(0);
    expect(screen.queryByText("Health Wiki contributor")).toBeNull();
  });

  it("falls back to 'Patient Profile' when no name is known", async () => {
    tagIs({ isContributor: false });
    renderPage();
    expect((await screen.findAllByRole("heading", { name: "Patient Profile" })).length).toBeGreaterThan(0);
  });

  it("prefers the contributor's name over the booking name", async () => {
    patientProfile.fullName = "Booking Name";
    tagIs({ isContributor: true, role: "WRITER", status: "PENDING", fullName: "Rohan Mehta" });
    renderPage();
    expect((await screen.findAllByRole("heading", { name: "Rohan Mehta" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Booking Name" })).toBeNull();
  });

  it("shows a tag for someone the team invited who has not finished, and asks them to finish", async () => {
    tagIs({ isContributor: true, role: "INDEPENDENT_DOCTOR", status: "INVITED", fullName: "Aquib (test)" });
    renderPage();
    expect((await screen.findAllByText(/Independent doctor · Profile not completed/)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Aquib (test)" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Complete your Health Wiki profile/ })).toHaveAttribute("href", "/contribute/join");
    expect(screen.queryByText("My Health Wiki articles")).toBeNull();
  });
});

describe("Profile: Health Wiki", () => {
  it("shows the way into the contributor area for a contributor", async () => {
    tagIs({ isContributor: true, role: "INDEPENDENT_DOCTOR", status: "VERIFIED", fullName: "Dr. Asha Rao" });
    renderPage();
    expect(await screen.findByText("My Health Wiki articles")).toBeInTheDocument();
    expect(screen.queryByText("Write for the Health Wiki")).toBeNull();
    expect(screen.getByRole("link", { name: /Doctor-reviewed health guides/ })).toHaveAttribute("href", "/health");
  });

  it("says the profile is under review for a contributor who is not verified yet", async () => {
    tagIs({ isContributor: true, role: "WRITER", status: "PENDING", fullName: "Rohan" });
    renderPage();
    expect((await screen.findAllByText(/Writer \/ technologist · Under review/)).length).toBeGreaterThan(0);
  });

  it("offers joining to someone who is not a contributor, and shows no tag", async () => {
    tagIs({ isContributor: false });
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
        ? { ok: true, json: async () => ({ isContributor: true, role: "WRITER", status: "VERIFIED", fullName: "Rohan" }) }
        : { ok: true, json: async () => ({ signedIn: true, needsRegistration: false }) });
    renderPage();
    await userEvent.click(await screen.findByText("My Health Wiki articles"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/contribute"));
    expect(fetchMock).toHaveBeenCalledWith("/api/contributor/session-from-patient", expect.objectContaining({ method: "POST" }));
  });
});
