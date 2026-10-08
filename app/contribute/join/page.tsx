import Link from "next/link";
import OnboardingFlow from "@/components/contributor/OnboardingFlow";
import { PageTitle } from "@/components/contributor/ui";

export default function JoinPage() {
  return (
    <div>
      <PageTitle title="Join as a contributor" sub="Write for the Health Wiki, or help us check what we publish." />
      <OnboardingFlow />
      <p className="text-center text-sm text-slate-500 mt-8">Already registered? <Link href="/contribute/login" className="font-bold text-brand-teal hover:underline">Sign in</Link></p>
    </div>
  );
}
