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

vi.mock("./CoverCropDialog", () => ({
  default: ({ file, onApply, onSkip, onCancel }: { file: File; onApply: (f: File) => void; onSkip: () => void; onCancel: () => void }) => (
    <div role="dialog" aria-label="crop">
      <span>cropping {file.name}</span>
      <button onClick={() => onApply(new File(["c"], "cropped.webp", { type: "image/webp" }))}>Use this crop</button>
      <button onClick={onSkip}>Use the whole picture, no crop</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

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
  it("opens the crop window for a chosen photo, and uploads the cropped cover", async () => {
    api.uploadImage.mockResolvedValue("https://cdn.example.com/a.webp");
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), photo);

    expect(await screen.findByText("cropping IMG_1.jpg")).toBeInTheDocument();
    expect(api.uploadImage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Use this crop" }));

    await waitFor(() => expect(api.uploadImage).toHaveBeenCalledTimes(1));
    expect((api.uploadImage.mock.calls[0][0] as File).name).toBe("cropped.webp");
    expect(await screen.findByLabelText(/Alt text/)).toBeInTheDocument();
    expect(screen.getByText(/Add it if you can/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "crop" })).toBeNull();
  });

  it("lets them use the whole picture without cropping: it is only made smaller", async () => {
    const small = new File([new Uint8Array(300_000)], "IMG_1.webp", { type: "image/webp" });
    prep.prepareImage.mockResolvedValue(small);
    api.uploadImage.mockResolvedValue("https://cdn.example.com/a.webp");
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole("button", { name: "Use the whole picture, no crop" }));

    await waitFor(() => expect(api.uploadImage).toHaveBeenCalledWith(small));
    expect(prep.prepareImage).toHaveBeenCalledWith(photo);
  });

  it("uploads nothing when the crop window is cancelled", async () => {
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "crop" })).toBeNull();
    expect(api.uploadImage).not.toHaveBeenCalled();
  });

  it("offers Crop and position again for the cover just added", async () => {
    api.uploadImage.mockResolvedValue("https://cdn.example.com/a.webp");
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole("button", { name: "Use this crop" }));
    await userEvent.click(await screen.findByRole("button", { name: "Crop and position" }));
    expect(await screen.findByText("cropping IMG_1.jpg")).toBeInTheDocument();
  });

  it("says what is wrong with a file it cannot use, and opens nothing", async () => {
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), new File(["x"], "a.gif", { type: "image/gif" }), { applyAccept: false });
    expect(await screen.findByRole("alert")).toHaveTextContent(/JPG, PNG or WebP/);
    expect(screen.queryByRole("dialog", { name: "crop" })).toBeNull();
    expect(api.uploadImage).not.toHaveBeenCalled();
  });

  it("shows the server's own message when the upload fails", async () => {
    api.uploadImage.mockRejectedValue(new Error("You have reached today's limit for image uploads. Try again tomorrow."));
    const { container } = render(<ArticleForm me={me} />);
    await userEvent.upload(chooser(container), photo);
    await userEvent.click(await screen.findByRole("button", { name: "Use this crop" }));
    expect(await screen.findByText(/today's limit/)).toBeInTheDocument();
  });
});
