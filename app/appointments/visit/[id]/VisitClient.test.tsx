import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The visit page (vision Phase 4): directions and the hospital's guide before the visit; check in on the day (too far is said so);
// the token and wait; after the visit, the follow-up and a rating.

vi.mock("@/components/patient/PatientTopBar", () => ({ default: () => null }));
import VisitClient from "./VisitClient";
import { I18nProvider } from "@/lib/i18n/I18nContext";

const ID = "abcdef12-3456-7890-abcd-ef1234567890";
const VISIT = {
  appointmentId: ID, reference: "ABCDEF12", statusCode: "PRE_APPOINTMENT", status: "Requested", confirmed: false, cancelled: false,
  completed: false, doctorId: "00000000-0000-0000-0000-000000000003", doctorName: "Dr. Anita Sen", hospitalId: "h", hospitalName: "Salt Lake Care",
  address: "Sector V", city: "Kolkata", contact: "03340001111", latitude: 22.58, longitude: 88.42,
  mapUrl: "https://www.google.com/maps/dir/?api=1&destination=22.58,88.42", date: "2026-10-26", time: "09:00", isToday: true, fee: 600,
  guide: { landmark: "Opposite City Centre", registrationDesk: "Counter 3, ground floor", opdLocation: "1st floor" },
  canCheckIn: true, token: null, followUpDate: null,
};

let visit: Record<string, unknown>;
let checkIn: { status: number; body: unknown };
const calls: string[] = [];

beforeEach(() => {
  visit = JSON.parse(JSON.stringify(VISIT));
  checkIn = { status: 200, body: { success: true, tokenNo: 7 } };
  calls.length = 0;
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 22.58, longitude: 88.42, accuracy: 15 } } as GeolocationPosition) } });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.endsWith("/checkin")) {
      if (checkIn.status === 200) visit = { ...visit, canCheckIn: false, token: { tokenNo: 7, currentServingTokenNo: 4, estimatedWaitMinutes: 25 } };
      return new Response(JSON.stringify(checkIn.body), { status: checkIn.status });
    }
    if (url.includes("not-found")) return new Response(JSON.stringify({ success: false }), { status: 404 });
    return new Response(JSON.stringify({ success: true, visit }), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const show = (id = ID) => render(<I18nProvider><VisitClient appointmentId={id} /></I18nProvider>);

describe("visit page", () => {
  it("shows where and when, directions and the hospital's guide", async () => {
    show();
    expect(await screen.findByRole("heading", { name: "Dr. Anita Sen" })).toBeTruthy();
    expect(screen.getByText("Booking ID: ABCDEF12")).toBeTruthy();
    expect(screen.getByText("Requested. The hospital will confirm the time.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /directions/i }).getAttribute("href")).toContain("destination=22.58,88.42");
    expect(screen.getByText("Counter 3, ground floor")).toBeTruthy();
    expect(screen.getByText("Pay ₹600 at the hospital counter.")).toBeTruthy();
  });

  it("checks in on the day and shows the token and the wait", async () => {
    show();
    await userEvent.click(await screen.findByRole("button", { name: "I've reached: check me in" }));
    expect(calls).toContain(`POST /api/public/appointments/${ID}/checkin`);
    expect(await screen.findByText("7")).toBeTruthy();
    expect(screen.getByText("Now seeing 4")).toBeTruthy();
    expect(screen.getByText("About 25 min to go")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I've reached: check me in" })).toBeNull();
  });

  it("says so when the patient is not at the hospital yet", async () => {
    checkIn = { status: 400, body: { success: false, message: "You don't appear to be at the hospital yet. Please check in at reception if this seems wrong." } };
    show();
    await userEvent.click(await screen.findByRole("button", { name: "I've reached: check me in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/don't seem to be at the hospital yet/);
  });

  it("after the visit offers the follow-up the doctor asked for and a rating", async () => {
    visit = { ...visit, completed: true, statusCode: "COMPLETED", isToday: false, followUpDate: "2026-11-09" };
    show();
    expect(await screen.findByText(/follow-up on 9 November/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Book follow-up" }).getAttribute("href")).toMatch(/\/doctors\/dr-anita-sen-kolkata--00000000-0000-0000-0000-000000000003#book$/);
    expect(screen.getByRole("link", { name: "Rate your visit" }).getAttribute("href")).toMatch(/#reviews$/);
    expect(screen.queryByRole("link", { name: /directions/i })).toBeNull();
  });

  it("an unknown booking says so", async () => {
    show("not-found");
    expect((await screen.findByRole("alert")).textContent).toBe("We couldn't find this booking.");
  });
});
