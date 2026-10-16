import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/usePatientAuth", () => ({ usePatientAuth: () => ({ isLoggedIn: true, isLoading: false, mobile: "9876543210" }) }));

import FamilyMembersPanel from "./FamilyMembersPanel";

const fetchMock = vi.fn();
let members: Record<string, unknown>[];
let sent: { url: string; method: string; body?: Record<string, unknown> }[];
const ayaan = { memberId: "m1", firstName: "Ayaan", lastName: "Khan", fullName: "Ayaan Khan", relation: "Son", age: 4, ageUnit: "Y", sex: "Male", bloodGroup: "O+", allergies: "Peanuts", documentCount: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  members = [];
  sent = [];
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET") return { ok: true, status: 200, json: async () => ({ success: true, max: 10, members }) };
    sent.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === "POST") members = [{ ...ayaan, ...sent[sent.length - 1].body, fullName: "Ayaan Khan", memberId: "m1", documentCount: 0 }];
    if (method === "DELETE") members = [];
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  });
});

const renderPanel = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><FamilyMembersPanel /></QueryClientProvider>);

describe("Family Members", () => {
  it("invites the first member when there are none", async () => {
    renderPanel();
    expect(await screen.findByText("No family members yet")).toBeInTheDocument();
  });

  it("adds a child: the card shows their details and a link to their health records", async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Add a family member" }));
    const form = screen.getByRole("form", { name: "Add family member" });
    await userEvent.type(within(form).getByLabelText("First name"), "Ayaan");
    await userEvent.type(within(form).getByLabelText(/Last name/), "Khan");
    await userEvent.type(within(form).getByLabelText("Age"), "4");
    await userEvent.selectOptions(within(form).getByLabelText(/Blood group/), "O+");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
    expect(await screen.findByText("Ayaan Khan")).toBeInTheDocument();
    expect(sent[0]).toMatchObject({ url: "/api/public/patients/me/family", method: "POST", body: { firstName: "Ayaan", lastName: "Khan", relation: "Son", age: 4, ageUnit: "Y", bloodGroup: "O+" } });
    expect(screen.getByRole("link", { name: /Health records/ })).toHaveAttribute("href", "/profile/health-locker?member=m1");
    expect(toast.success).toHaveBeenCalled();
  });

  it("needs a first name and sends nothing without one", async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Add a family member" }));
    const form = screen.getByRole("form", { name: "Add family member" });
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Enter the first name");
    expect(sent).toHaveLength(0);
  });

  it("edits a member with PUT to their own id", async () => {
    members = [ayaan];
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form", { name: "Edit family member" });
    expect(within(form).getByLabelText("First name")).toHaveValue("Ayaan");
    await userEvent.type(within(form).getByLabelText(/Allergies/), " and dust");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent[0]).toMatchObject({ url: "/api/public/patients/me/family/m1", method: "PUT", body: { allergies: "Peanuts and dust" } }));
  });

  it("asks before removing, and says how many records go with them", async () => {
    members = [ayaan];
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Remove Ayaan" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Remove Ayaan and 2 records?");
    expect(sent).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(sent[0]).toMatchObject({ url: "/api/public/patients/me/family/m1", method: "DELETE" }));
    expect(await screen.findByText("No family members yet")).toBeInTheDocument();
  });

  it("shows the server's message when saving fails", async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) =>
      init?.method === "POST" ? { ok: false, status: 400, json: async () => ({ success: false, message: "You can add up to 10 family members." }) } : { ok: true, status: 200, json: async () => ({ success: true, members: [] }) });
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Add a family member" }));
    const form = screen.getByRole("form", { name: "Add family member" });
    await userEvent.type(within(form).getByLabelText("First name"), "Zed");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("up to 10");
  });
});
