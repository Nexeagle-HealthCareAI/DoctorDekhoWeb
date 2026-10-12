import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/contribute", useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = vi.hoisted(() => ({
  sendOtp: vi.fn(), verifyOtp: vi.fn(), register: vi.fn(), uploadImage: vi.fn(), me: vi.fn(),
}));
vi.mock("@/lib/contributor/client", () => ({ contributorApi: api, ApiError: class extends Error {} }));

import OtpStep from "./OtpStep";
import RegisterForm from "./RegisterForm";
import TopicForm from "./TopicForm";
import OnboardingFlow from "./OnboardingFlow";
import SubmitConsentDialog from "./SubmitConsentDialog";

beforeEach(() => vi.clearAllMocks());

describe("RegisterForm", () => {
  it("asks a doctor for registration number, council and consent", async () => {
    render(<RegisterForm role="INDEPENDENT_DOCTOR" defaultName="Dr. Kavita Rao" onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Create my profile" }));
    expect(await screen.findByText("Registration number is required.")).toBeInTheDocument();
    expect(screen.getByText("Choose the council.")).toBeInTheDocument();
    expect(screen.getByText("Please tick this to continue.")).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it("asks a writer for a job title, and no registration number", async () => {
    render(<RegisterForm role="WRITER" defaultName="Rohan" onDone={vi.fn()} />);
    expect(screen.queryByLabelText("Medical registration number")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Create my profile" }));
    expect(await screen.findByText("Enter your job title.")).toBeInTheDocument();
  });

  it("sends the details once they are complete", async () => {
    api.register.mockResolvedValue({ fullName: "Rohan" });
    const done = vi.fn();
    render(<RegisterForm role="WRITER" defaultName="Rohan Mehta" onDone={done} />);
    await userEvent.type(screen.getByLabelText("Job title", { exact: true }), "Product manager");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Create my profile" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Rohan Mehta", roleTitle: "Product manager", consent: true }));
  });

  it("rejects a photo that is too big or the wrong type", async () => {
    render(<RegisterForm role="WRITER" onDone={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "a.gif", { type: "image/gif" }), { applyAccept: false });
    expect(await screen.findByText("Use a JPG, PNG or WebP photo.")).toBeInTheDocument();
    await userEvent.upload(input, new File([new Uint8Array(3 * 1024 * 1024)], "big.png", { type: "image/png" }));
    expect(await screen.findByText("That photo is over 2 MB.")).toBeInTheDocument();
    expect(api.uploadImage).not.toHaveBeenCalled();
  });
});

describe("OtpStep", () => {
  it("needs a 10-digit number before it sends a code", async () => {
    render(<OtpStep onVerified={vi.fn()} />);
    const send = screen.getByRole("button", { name: /Send code/ });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "98765abc43210");
    expect(screen.getByLabelText("WhatsApp number")).toHaveValue("9876543210");
    expect(send).toBeEnabled();
  });

  it("shows the code screen after sending, and the demo code when the backend gives one", async () => {
    api.sendOtp.mockResolvedValue({ sent: true, devCode: "123456" });
    render(<OtpStep inviteToken="demo" onVerified={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "9876543210");
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    expect(await screen.findByText("Enter the code")).toBeInTheDocument();
    expect(screen.getByText(/Demo only/)).toHaveTextContent("123456");
    expect(api.sendOtp).toHaveBeenCalledWith("9876543210", "demo");
  });

  it("shows the server's message when the number is wrong for this link", async () => {
    api.sendOtp.mockRejectedValue(new Error("This link was sent to a different number."));
    render(<OtpStep inviteToken="demo" onVerified={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "9000000000");
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("different number");
  });

  it("reports whether a profile still has to be created once the code is accepted", async () => {
    api.sendOtp.mockResolvedValue({ sent: true });
    api.verifyOtp.mockResolvedValue({ signedIn: true, needsRegistration: true });
    const verified = vi.fn();
    render(<OtpStep role="WRITER" onVerified={verified} />);
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "9876543210");
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    await screen.findByText("Enter the code");
    await userEvent.keyboard("123456");
    await waitFor(() => expect(verified).toHaveBeenCalledWith(true));
    expect(api.verifyOtp).toHaveBeenCalledWith("9876543210", "123456", { inviteToken: undefined, role: "WRITER" });
  });
});

describe("OnboardingFlow", () => {
  it("makes a self-enrolling person pick a role first", async () => {
    render(<OnboardingFlow />);
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: /Health worker/ }));
    expect(next).toBeEnabled();
    await userEvent.click(next);
    expect(await screen.findByText("Confirm it is you")).toBeInTheDocument();
  });

  it("asks for the details of the account the number already has, not the role that was just picked", async () => {
    api.sendOtp.mockResolvedValue({ sent: true });
    api.verifyOtp.mockResolvedValue({ signedIn: true, needsRegistration: true });
    api.me.mockResolvedValue({ role: "INDEPENDENT_DOCTOR", fullName: "" });
    render(<OnboardingFlow />);
    await userEvent.click(screen.getByRole("radio", { name: /Writer/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.type(screen.getByLabelText("WhatsApp number"), "9876543210");
    await userEvent.click(screen.getByRole("button", { name: /Send code/ }));
    await screen.findByText("Enter the code");
    await userEvent.keyboard("123456");
    expect(await screen.findByLabelText("Medical registration number")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/already set up as independent doctor/i);
  });

  it("skips the role step when an invitation already fixed it", () => {
    render(<OnboardingFlow inviteToken="demo" fixedRole="INDEPENDENT_DOCTOR" />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByText("Confirm it is you")).toBeInTheDocument();
  });
});

describe("TopicForm", () => {
  it("needs the topic, the outline and the reason", async () => {
    const onSubmit = vi.fn();
    render(<TopicForm sectorOnly={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Send to the team" }));
    expect(await screen.findByText("Name the topic.")).toBeInTheDocument();
    expect(screen.getByText("Say what you would write about.")).toBeInTheDocument();
    expect(screen.getByText("Say why readers need it.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("limits a writer to sector updates and hides the condition", () => {
    render(<TopicForm sectorOnly onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Type")).toBeDisabled();
    expect(screen.queryByLabelText(/Related condition/)).toBeNull();
  });

  it("sends a trimmed request", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TopicForm sectorOnly={false} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Topic"), "  Heat stroke  ");
    await userEvent.type(screen.getByLabelText("What would you write about?"), "First aid");
    await userEvent.type(screen.getByLabelText("Why does it matter?"), "Summer");
    await userEvent.click(screen.getByRole("button", { name: "Send to the team" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Heat stroke", type: "MEDICAL", conditionSlug: null })));
  });
});

describe("SubmitConsentDialog", () => {
  it("explains what happens next and only sends once the author agrees", async () => {
    const onConfirm = vi.fn();
    render(<SubmitConsentDialog open medical busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText(/will publish it on Doctor Dekho/)).toBeInTheDocument();
    expect(screen.getByText(/tell you what to fix/)).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Send for review" });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("names a NexEagle editor, not a doctor, for a sector update", () => {
    render(<SubmitConsentDialog open medical={false} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/NexEagle editor may publish this article/)).toBeInTheDocument();
  });

  it("can be cancelled without agreeing", async () => {
    const onCancel = vi.fn();
    render(<SubmitConsentDialog open medical busy={false} onCancel={onCancel} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("TopicForm: asking for a writer", () => {
  it("lets a doctor ask for a writer, and sends that with the topic", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TopicForm sectorOnly={false} canAskWriter onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Topic"), "Sleep and blood pressure");
    await userEvent.type(screen.getByLabelText("What would you write about?"), "How poor sleep raises BP.");
    await userEvent.type(screen.getByLabelText("Why does it matter?"), "Patients ask.");
    await userEvent.click(screen.getByRole("checkbox", { name: /someone else to write it/i }));
    await userEvent.click(screen.getByRole("button", { name: "Send to the team" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Sleep and blood pressure", requestWriter: true })));
  });

  it("does not offer it to a writer or health worker", () => {
    render(<TopicForm sectorOnly onSubmit={vi.fn()} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
