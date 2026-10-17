import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, back: vi.fn(), push: vi.fn() }),
  usePathname: () => "/profile/health-locker",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/components/patient/PatientTopBar", () => ({ default: () => null }));
vi.mock("@/components/patient/ProfileShell", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/usePatientAuth", () => ({
  usePatientAuth: () => ({
    isLoggedIn: true,
    isLoading: false,
    appointments: [{ appointmentId: "a1", doctorName: "Dr. Mehta", hospitalName: "City Care", apptDate: "2026-09-10T00:00:00", startAt: "", status: "Completed", statusCode: "COMPLETED" }],
  }),
}));

import HealthLockerClient from "./HealthLockerClient";

const fetchMock = vi.fn();
let uploads: FormData[];
const ayaan = { memberId: "m1", firstName: "Ayaan", lastName: "Khan", fullName: "Ayaan Khan", relation: "Son", age: 4, ageUnit: "Y", sex: "Male", bloodGroup: null, allergies: null, documentCount: 1 };
const docs = [
  { documentId: "d1", fileName: "mine.pdf", documentType: "Lab Report", uploadedAt: "2026-09-20T00:00:00", memberId: null, doctorName: "Dr. Mehta", hospitalName: "City Care", visitDate: "2026-09-10T00:00:00" },
  { documentId: "d2", fileName: "ayaan.pdf", documentType: "Prescription", uploadedAt: "2026-09-21T00:00:00", memberId: "m1", externalDoctorName: "Dr. Rao", externalClinicName: "Rao Clinic", externalLocation: "Lucknow", visitDate: "2026-09-01T00:00:00" },
];

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  uploads = [];
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      uploads.push(init.body as FormData);
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
    if (url.startsWith("/api/public/patients/me/family")) return { ok: true, status: 200, json: async () => ({ success: true, members: [ayaan] }) };
    return { ok: true, status: 200, json: async () => ({ success: true, documents: docs }) };
  });
});

const renderPage = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HealthLockerClient /></QueryClientProvider>);
const file = () => new File(["x"], "report.pdf", { type: "application/pdf" });
const pickFile = async () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, file());
};

describe("Health Locker: whose record and which visit", () => {
  it("lists everyone's records with the person and the visit on each", async () => {
    renderPage();
    expect(await screen.findByText("ayaan.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("Ayaan Khan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Me").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Dr\. Rao · Rao Clinic, Lucknow · 01 Sep/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Mehta · City Care · 10 Sep/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("documents?all=true"))).toBe(true);
  });

  it("switching to a family member asks for just their records", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Ayaan" }));
    expect(nav.replace).toHaveBeenCalledWith("/profile/health-locker?member=m1");
  });

  it("saves a record for a family member, linked to a doctor who is not listed", async () => {
    renderPage();
    await screen.findByText("ayaan.pdf");
    await userEvent.selectOptions(screen.getByLabelText("This record is for"), "m1");
    await userEvent.selectOptions(screen.getByLabelText(/Doctor visit/), "other");
    await userEvent.type(screen.getByLabelText(/Doctor.s name/), "Dr. Rao");
    await userEvent.type(screen.getByLabelText(/Clinic or hospital/), "Rao Clinic");
    await userEvent.type(screen.getByLabelText(/Location/), "Lucknow");
    await pickFile();
    await userEvent.click(screen.getByRole("button", { name: "Save to Health Locker" }));

    await waitFor(() => expect(uploads).toHaveLength(1));
    const f = uploads[0];
    expect([f.get("MemberId"), f.get("ExternalDoctorName"), f.get("ExternalClinicName"), f.get("ExternalLocation"), f.get("ApptId")]).toEqual(["m1", "Dr. Rao", "Rao Clinic", "Lucknow", null]);
    expect(toast.success).toHaveBeenCalledWith("Saved to Ayaan's records.");
  });

  it("saves a record against one of the patient's own appointments", async () => {
    renderPage();
    await screen.findByText("ayaan.pdf");
    await userEvent.selectOptions(screen.getByLabelText(/Doctor visit/), "appointment");
    await userEvent.selectOptions(screen.getByLabelText("Which visit"), "a1");
    await pickFile();
    await userEvent.click(screen.getByRole("button", { name: "Save to Health Locker" }));

    await waitFor(() => expect(uploads).toHaveLength(1));
    expect([uploads[0].get("ApptId"), uploads[0].get("MemberId"), uploads[0].get("ExternalDoctorName")]).toEqual(["a1", null, null]);
  });

  it("will not save a typed-in visit without the doctor's name", async () => {
    renderPage();
    await screen.findByText("ayaan.pdf");
    await userEvent.selectOptions(screen.getByLabelText(/Doctor visit/), "other");
    await pickFile();
    await userEvent.click(screen.getByRole("button", { name: "Save to Health Locker" }));
    expect(toast.error).toHaveBeenCalledWith("Enter the doctor's name.");
    expect(uploads).toHaveLength(0);
  });
});
