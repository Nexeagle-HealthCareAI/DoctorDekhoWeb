"use client";

import ArticleForm from "@/components/contributor/ArticleForm";
import { BackLink, Loading, PageTitle } from "@/components/contributor/ui";
import { useContributor } from "@/lib/contributor/hooks";

export default function WritePage() {
  const { me } = useContributor();
  if (!me) return <Loading />;
  return (
    <div>
      <BackLink href="/contribute">My articles</BackLink>
      <PageTitle title="Write an article" sub="Write in plain language for patients and readers. Our team checks it before it goes live." />
      <ArticleForm me={me} />
    </div>
  );
}
