"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import TopicForm from "@/components/contributor/TopicForm";
import { BackLink, Banner, Loading, PageTitle, card } from "@/components/contributor/ui";
import { contributorApi } from "@/lib/contributor/client";
import { useContributor, useLoad } from "@/lib/contributor/hooks";
import { OPEN_TOPIC_LIMIT, type TopicRequest } from "@/lib/contributor/types";

export default function NewTopicPage() {
  const router = useRouter();
  const { me } = useContributor();
  const topics = useLoad<TopicRequest[]>(() => contributorApi.topics());
  if (!me || topics.loading) return <Loading />;

  const open = (topics.data ?? []).filter((t) => t.status === "SUBMITTED" || t.status === "NEEDS_DETAIL").length;
  const full = open >= OPEN_TOPIC_LIMIT;
  const approved = me.status === "VERIFIED";

  return (
    <div className="max-w-2xl">
      <BackLink href="/contribute/topics">Topic requests</BackLink>
      <PageTitle title="Suggest a topic" sub="Tell the team what you would like to write. If they accept it, a draft is created for you." />
      <div className={`${card} p-5 sm:p-8 space-y-5`}>
        {!approved && <Banner tone="warn">You can send topic requests once the team has {me.role === "INDEPENDENT_DOCTOR" ? "verified your registration" : "approved your profile"}.</Banner>}
        {full && <Banner tone="warn">You already have {OPEN_TOPIC_LIMIT} open requests. Wait for a decision before you send another.</Banner>}
        {approved && !full && (
          <TopicForm
            sectorOnly={me.role === "WRITER"}
            onSubmit={async (input) => {
              await contributorApi.createTopic(input);
              toast.success("Sent to the team. You will hear back on WhatsApp.");
              router.push("/contribute/topics");
            }}
            onCancel={() => router.push("/contribute/topics")}
          />
        )}
      </div>
    </div>
  );
}
