import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = vi.hoisted(() => ({ createArticle: vi.fn(), updateArticle: vi.fn(), submitArticle: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/lib/contributor/client", () => ({ contributorApi: api, ApiError: class extends Error {} }));
const prep = vi.hoisted(() => ({ prepareImage: vi.fn() }));
vi.mock("@/lib/contributor/prepareImage", async (orig) => ({ ...(await orig<typeof import("@/lib/contributor/prepareImage")>()), prepareImage: prep.prepareImage }));

import ArticleForm from "./ArticleForm";
import { ImageProblem } from "@/lib/contributor/prepareImage";
import type { ContributorMe } from "@/lib/contributor/types";

const me: ContributorMe = {
  id: "c1", role: "INDEPENDENT_DOCTOR", fullName: "Dr. Meera", mobileMasked: "+91 98••• ••127", status: "VERIFIED",
  speciality: null, qualification: null, roleTitle: null, organisation: null, registrationNumber: "1", registrationCouncil: "DMC", rejectReason: null,
};
const photo = new File([new Uint8Array(8_000_000)], "IMG_1.jpg", { type: "image/jpeg" });
const chooser = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => vi.clearAllMocks());

describe("Cover image", () => {
  it("makes a big photo small, uploads that, and shows it with an optional alt text", async () => {
    const small = new File([new Uint8Array(300_000)], "IMG_1.webp", { type: "image/webp" });
    prep.prepareImage.mockResolvedValue(small);
    api.uploadImage.mockResolvedValue("https://cdn.example.com/a.webp");
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), photo);

    await waitFor(() => expect(api.uploadImage).toHaveBeenCalledWith(small));
    expect(prep.prepareImage).toHaveBeenCalledWith(photo);
    expect(await screen.findByLabelText(/Alt text/)).toBeInTheDocument();
    expect(screen.getByText(/Add it if you can/)).toBeInTheDocument();
  });

  it("says what is wrong with a picture it cannot use, and uploads nothing", async () => {
    prep.prepareImage.mockRejectedValue(new ImageProblem("Use a JPG, PNG or WebP picture, or an iPhone (HEIC) photo."));
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), new File(["x"], "a.gif", { type: "image/gif" }), { applyAccept: false });

    expect(await screen.findByRole("alert")).toHaveTextContent(/JPG, PNG or WebP/);
    expect(api.uploadImage).not.toHaveBeenCalled();
  });

  it("shows the server's own message when the upload fails", async () => {
    prep.prepareImage.mockResolvedValue(photo);
    api.uploadImage.mockRejectedValue(new Error("You have reached today's limit for image uploads. Try again tomorrow."));
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(/today's limit/);
  });
});
