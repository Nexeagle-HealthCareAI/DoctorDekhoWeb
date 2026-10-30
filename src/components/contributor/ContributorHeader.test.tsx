import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/contribute", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const api = vi.hoisted(() => ({ me: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/contributor/client", () => ({ contributorApi: api }));
vi.mock("@/hooks/usePatientAuth", () => ({ usePatientAuth: () => ({ isLoggedIn: false }) }));
vi.mock("@/components/patient/AccountMenu", () => ({ default: () => null }));

import ContributorHeader from "./ContributorHeader";

beforeEach(() => {
  vi.clearAllMocks();
  api.me.mockResolvedValue({ id: "c1", role: "INDEPENDENT_DOCTOR", fullName: "Dr. Asha Rao", status: "VERIFIED" });
});

describe("Contributor header", () => {
  it("takes the logo to the Doctor Dekho home page, and the words beside it back to the contributor area", async () => {
    render(<ContributorHeader />);
    expect(screen.getByRole("link", { name: "Doctor Dekho home" })).toHaveAttribute("href", "/");
    expect(await screen.findByRole("link", { name: "Health Wiki contributors home" })).toHaveAttribute("href", "/contribute");
  });

  it("sends someone who is not signed in to the Health Wiki from those words", async () => {
    api.me.mockRejectedValue(new Error("401"));
    render(<ContributorHeader />);
    expect(screen.getByRole("link", { name: "Doctor Dekho home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Health Wiki contributors home" })).toHaveAttribute("href", "/health");
  });
});
