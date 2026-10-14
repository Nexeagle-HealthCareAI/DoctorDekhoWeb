import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }) }));
const identity = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/hooks/usePatientIdentity", () => ({ usePatientIdentity: () => identity.value }));

import AccountMenu from "./AccountMenu";

const mutateAsync = vi.fn().mockResolvedValue({});
const signedIn = (extra: Record<string, unknown> = {}) => {
  identity.value = {
    isLoggedIn: true, isLoading: false, mobile: "9876543210", name: "Dr. Asha Rao", initials: "DA",
    tag: { isContributor: true, role: "INDEPENDENT_DOCTOR", status: "VERIFIED", fullName: "Dr. Asha Rao" },
    logout: { mutateAsync, isPending: false }, ...extra,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  identity.value = { isLoggedIn: false, isLoading: false, mobile: null, name: null, initials: "P", tag: undefined, logout: { mutateAsync, isPending: false } };
});

describe("Account menu in the top bar", () => {
  it("shows the signed-in person: their first name on the button and a profile card in the menu", async () => {
    signedIn();
    render(<AccountMenu />);
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("Dr.");
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("Dr. Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText(/Health Wiki · Independent doctor/)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Dr. Asha Rao/ })).toHaveAttribute("href", "/profile");
  });

  it("is where Sign out is: it signs out and goes to the home page", async () => {
    signedIn();
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Sign out/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("offers Log in / Register, and no Sign out, to someone who is not signed in", async () => {
    render(<AccountMenu />);
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("Log in / Register");
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: /Log in \/ Register/ })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("menuitem", { name: /Sign out/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Profile" })).toBeNull();
  });

  it("shows the mobile number when no name is known", async () => {
    signedIn({ name: null, initials: "97", tag: undefined });
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    // on the button and as the title of the profile card
    expect(screen.getAllByText("+91 9876543210")).toHaveLength(2);
  });

  it("closes with Escape", async () => {
    signedIn();
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
