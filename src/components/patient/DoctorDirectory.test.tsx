import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Doctor } from "@/data/patient";

// ── Mocks: the doctor list, the search-parse calls, analytics, and the doctor card ────────────
const doctors = vi.hoisted(() => ({ list: [] as unknown[] }));
const parse = vi.hoisted(() => ({ respond: (_input: unknown): unknown => ({}), calls: [] as unknown[] }));

vi.mock("@/lib/api/hooks", () => ({
  usePaginatedDoctors: () => ({
    doctors: doctors.list, totalCount: doctors.list.length, isLoading: false, isFetchingNextPage: false,
    hasNextPage: false, fetchNextPage: vi.fn(), isError: false,
  }),
  useSmartSearch: () => ({
    isPending: false,
    mutate: (input: unknown, opts?: { onSuccess?: (v: unknown) => void }) => {
      parse.calls.push(input);
      const result = parse.respond(input);
      Promise.resolve().then(() => opts?.onSuccess?.(result));
    },
  }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), recordLead: vi.fn() }));
vi.mock("@/lib/geo", () => ({ haversineDistance: () => 1, getDrivingDistances: () => Promise.resolve({}) }));
vi.mock("./DoctorCard", () => ({ default: ({ doctor }: { doctor: Doctor }) => <div data-testid="doctor">{doctor.name}</div> }));
vi.mock("@tanstack/react-query", () => ({ useIsRestoring: () => false }));

import DoctorDirectory from "./DoctorDirectory";
import { I18nProvider } from "@/lib/i18n/I18nContext";

const doctor = (id: string, name: string, specialtyId: string, specialty: string, focusAreas: string[]): Doctor =>
  ({ id, name, specialtyId, specialty, focusAreas, gradient: "", initials: "DR", qualifications: "MBBS", experienceYears: 10 } as unknown as Doctor);

const intent = (extra: Record<string, unknown> = {}) => ({
  specialtyId: null, specialtyIds: [], city: null, keywords: [], notConfigured: false, method: null, confidence: null,
  modelVersion: null, decision: null, emergency: null, clarify: null, reason: null, ...extra,
});

const show = (query: string) =>
  render(
    <I18nProvider>
      <DoctorDirectory city={null} cities={[]} geoStatus={"idle"} coords={null} onCityChange={() => {}} query={query} specialtyId="" />
    </I18nProvider>
  ) as unknown as { container: ReactNode };

beforeEach(() => {
  parse.calls = [];
  doctors.list = [
    doctor("1", "Dr. Heart", "cardiology", "Cardiology", ["chest pain", "palpitations"]),
    doctor("2", "Dr. Emergency", "emergencymedicine", "Emergency Medicine", ["trauma"]),
  ];
});

describe("Doctor Dekho search page: emergency warning", () => {
  it("safety-checks symptom text that keyword-matched a doctor, and shows the banner above the same results", async () => {
    parse.respond = () => intent({ emergency: { reasons: ["Chest pain"], source: "router" } });
    show("chest pain");
    expect(await screen.findByRole("alert")).toHaveTextContent("This may be a medical emergency");
    expect(screen.getByRole("alert")).toHaveTextContent("Chest pain");
    expect(screen.getByRole("link", { name: /Call 108/ })).toHaveAttribute("href", "tel:108");
    expect(parse.calls).toEqual([{ query: "chest pain", safetyOnly: true }]);
    // keyword results unchanged: the cardiologist whose focus area matched is still listed
    expect(screen.getByText("Dr. Heart")).toBeInTheDocument();
  });

  it("shows no banner when the safety check finds no emergency", async () => {
    parse.respond = () => ({ ...intent(), safetyOnly: true });
    show("palpitations");
    await waitFor(() => expect(parse.calls).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Dr. Heart")).toBeInTheDocument();
  });

  it("shows the banner when the full router search (no keyword match) finds an emergency", async () => {
    parse.respond = () =>
      intent({ emergency: { reasons: ["Chest pain", "Breathlessness"], source: "router" }, specialtyId: "emergencymedicine", specialtyIds: ["emergencymedicine", "cardiology"] });
    show("seene mein tez dard aur saans nahi aa rahi");
    expect(await screen.findByRole("alert")).toHaveTextContent("Chest pain, Breathlessness");
    expect(parse.calls).toEqual(["seene mein tez dard aur saans nahi aa rahi"]);
    expect(screen.getByText("Dr. Emergency")).toBeInTheDocument();
  });

  it("adds the Tele-MANAS helpline for self-harm", async () => {
    parse.respond = () => intent({ emergency: { reasons: ["Suicidal thoughts / self-harm"], source: "router" } });
    show("mujhe marne ka mann kar raha hai");
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: /Tele-MANAS 14416/ })).toHaveAttribute("href", "tel:14416");
  });

  it("does not show the self-harm helpline for other emergencies", async () => {
    parse.respond = () => intent({ emergency: { reasons: ["Chest pain"], source: "router" } });
    show("chest pain");
    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: /Tele-MANAS/ })).not.toBeInTheDocument();
  });

  it("does not call the router for very short text", async () => {
    show("ent");
    await Promise.resolve();
    expect(parse.calls).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
