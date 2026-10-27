"use client";

import ArticleForm from "@/components/contributor/ArticleForm";
import ArticleHistory from "@/components/contributor/ArticleHistory";
import { BackLink, ErrorBox, Loading, PageTitle } from "@/components/contributor/ui";
import { contributorApi } from "@/lib/contributor/client";
import { useContributor, useLoad } from "@/lib/contributor/hooks";
import type { MyArticle } from "@/lib/contributor/types";

export default function EditPage({ params }: { params: { slug: string } }) {
  const { me } = useContributor();
  const art = useLoad<MyArticle>(() => contributorApi.article(params.slug), [params.slug]);
  if (!me || art.loading) return <Loading />;
  if (art.error || !art.data) return <ErrorBox message={art.error ?? "Article not found."} onRetry={art.reload} />;
  return (
    <div>
      <BackLink href="/contribute">My articles</BackLink>
      <PageTitle title={art.data.title || "Untitled draft"} sub={art.data.status === "PUBLISHED" ? "Edit your published article. Your changes go live when you publish them." : "Edit your draft."} />
      {/* key: a different article starts the editor from scratch */}
      <ArticleForm key={art.data.slug} me={me} existing={art.data} />
      <ArticleHistory slug={art.data.slug} />
    </div>
  );
}
