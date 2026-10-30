import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/usePatientAuth", () => ({ usePatientAuth: () => ({ isLoggedIn: true, isLoading: false, mobile: "9876543210" }) }));

import PersonalInformationPanel from "./PersonalInformationPanel";

const fetchMock = vi.fn();
let saved: Record<string, unknown>;
const booking = { success: true, fullName: "Aquiib", age: 32, ageUnit: "Y", sex: "Male", guardianName: "abx", guardianRelation: "C/O", source: "BOOKING" };

beforeEach(() => {
  vi.clearAllMocks();
  saved = {};
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      saved = JSON.parse(String(init.body));
      return { ok: true, status: 200, json: async () => ({ success: true, ...saved, fullName: `${saved.firstName} ${saved.lastName ?? ""}`.trim(), source: "ACCOUNT" }) };
    }
    return { ok: true, status: 200, json: async () => booking };
  });
});

const renderPanel = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PersonalInformationPanel /></QueryClientProvider>);

describe("Personal Information: edit and save", () => {
  it("shows the details, and says where they come from", async () => {
    renderPanel();
    expect(await screen.findByText("Aquiib")).toBeInTheDocument();
    expect(screen.getByText("32 Years · Male")).toBeInTheDocument();
    expect(screen.getByText(/latest booking/)).toBeInTheDocument();
  });

  it("edits and saves: the page shows the new details and says they are saved on the account", async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    const form = screen.getByRole("form", { name: "Edit personal information" });
    const first = within(form).getByLabelText("First name");
    await userEvent.clear(first);
    await userEvent.type(first, "Aquib");
    await userEvent.type(within(form).getByLabelText(/Last name/), "Khan");
    await userEvent.selectOptions(within(form).getByLabelText(/Blood group/), "O+");
    await userEvent.type(within(form).getByLabelText(/Email/), "aquib@example.com");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
    expect(await screen.findByText("Aquib")).toBeInTheDocument();
    expect(screen.getByText("Khan")).toBeInTheDocument();
    expect(screen.getByText("O+")).toBeInTheDocument();
    expect(screen.getByText("aquib@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Saved on your Doctor Dekho account/)).toBeInTheDocument();
    expect(saved).toMatchObject({ firstName: "Aquib", lastName: "Khan", bloodGroup: "O+", age: 32, ageUnit: "Y", sex: "Male", email: "aquib@example.com" });
    expect(toast.success).toHaveBeenCalled();
  });

  it("needs a name, and keeps the form open with a message", async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    const form = screen.getByRole("form", { name: "Edit personal information" });
    await userEvent.clear(within(form).getByLabelText("First name"));
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Enter your first name");
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PUT")).toBe(false);
  });

  it("shows the server's message when saving fails, and keeps what was typed", async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) =>
      init?.method === "PUT" ? { ok: false, status: 400, json: async () => ({ success: false, message: "Enter a valid email address." }) } : { ok: true, status: 200, json: async () => booking });
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    const form = screen.getByRole("form", { name: "Edit personal information" });
    await userEvent.type(within(form).getByLabelText(/Email/), "nope");
    await userEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(within(form).getByLabelText(/Email/)).toHaveValue("nope");
  });

  it("Cancel leaves the details as they were", async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    await userEvent.type(screen.getByLabelText("First name"), " changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.getByText("Aquiib")).toBeInTheDocument();
  });

  it("splits an older single full name into first and last name for editing", async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ success: true, fullName: "Zara Bano Ali", source: "BOOKING" }) }));
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    expect(screen.getByLabelText("First name")).toHaveValue("Zara");
    expect(screen.getByLabelText(/Last name/)).toHaveValue("Bano Ali");
  });

  it("lets someone with nothing on file add details", async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ success: true, source: "NONE" }) }));
    renderPanel();
    expect(await screen.findByText("Nothing on file yet")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Add details" })[0]);
    expect(screen.getByRole("form", { name: "Edit personal information" })).toBeInTheDocument();
  });
});
