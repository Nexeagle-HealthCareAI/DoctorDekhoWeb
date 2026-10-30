"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RegisterForm from "@/components/contributor/RegisterForm";
import { ErrorBox, Loading, PageTitle } from "@/components/contributor/ui";
import { useContributor } from "@/lib/contributor/hooks";
import type { EnrolRole } from "@/lib/contributor/types";

// The last step of joining for a person who is already signed in (from their Doctor Dekho login, or the team's invitation): their contributor
// profile. Someone who has finished goes to their articles.
export default function RegisterPage() {
  const router = useRouter();
  const { me, error } = useContributor({ allowUnregistered: true });
  const finished = !!me && me.status !== "INVITED" && !!me.fullName;

  useEffect(() => {
    if (finished) router.replace("/contribute");
  }, [finished, router]);

  if (error) return <ErrorBox message={error} />;
  if (!me || finished) return <Loading />;
  return (
    <div>
      <PageTitle title="Finish your profile" sub="One step left before you can write or review." />
      <RegisterForm role={me.role as EnrolRole} defaultName={me.fullName || undefined} onDone={() => router.replace("/contribute")} />
    </div>
  );
}
