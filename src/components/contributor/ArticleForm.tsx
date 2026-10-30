"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { contributorApi } from "@/lib/contributor/client";
import { CONDITION_OPTIONS, SLUG_LABEL } from "@/lib/contributor/conditions";
import { messageOf } from "@/lib/contributor/hooks";
import { IMAGE_ACCEPT, ImageProblem, checkImageFile, prepareImage } from "@/lib/contributor/prepareImage";
import { ARTICLE_TYPE_LABEL } from "@/lib/health-wiki/types";
import { canSelfPublish, isDoctorRole, type ArticleDraftInput, type ArticleType, type ContributorMe, type MyArticle } from "@/lib/contributor/types";
import { Banner, Field, card, input, primaryBtn, secondaryBtn } from "./ui";
import SubmitConsentDialog from "./SubmitConsentDialog";
import CoverCropDialog from "./CoverCropDialog";

// The editor needs the browser, so it is not rendered on the server.
const RichTextEditor = dynamic(() => import("./RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" aria-label="Loading editor" />,
});

type Errors = Partial<Record<"title" | "content" | "cover" | "form", string>>;

interface Props {
  me: ContributorMe;
  /** The draft being edited; absent for a new article. */
  existing?: MyArticle;
}

export default function ArticleForm({ me, existing }: Props) {
  const router = useRouter();
  const doctor = isDoctorRole(me.role);
  const writer = me.role === "WRITER";
  const coverInput = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  // The picture being cropped, and the picture the current cover came from (kept so the crop can be adjusted again in this visit).
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [coverSource, setCoverSource] = useState<File | null>(null);
  const [coverOver, setCoverOver] = useState(false);
  const selfPublish = canSelfPublish(me, existing);
  // A verified doctor can keep editing their live article: the changes go live when they publish them.
  const locked = !!existing && existing.status !== "DRAFT" && !(selfPublish && existing.status === "PUBLISHED");

  const [type, setType] = useState<ArticleType>(existing?.type ?? (writer ? "SECTOR_UPDATE" : "MEDICAL"));
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(existing?.coverImageUrl ?? null);
  const [coverAlt, setCoverAlt] = useState(existing?.coverImageAlt ?? "");
  const [condition, setCondition] = useState<string | null>(existing?.relatedConditionSlug ?? null);
  const [references, setReferences] = useState(existing?.references ?? "");
  const [disclosure, setDisclosure] = useState(existing?.disclosure ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const first = useRef(true);

  const snapshot = useMemo(() => JSON.stringify([type, title, description, content, coverUrl, coverAlt, condition, references, disclosure]), [type, title, description, content, coverUrl, coverAlt, condition, references, disclosure]);
  useEffect(() => {
    // The editor reports its markdown once when it mounts; that first change is not an edit.
    if (first.current) { first.current = false; return; }
    setDirty(true);
  }, [snapshot]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const medical = type === "MEDICAL";
  // A filled-in profile the team has not rejected may send an article for review; the reviewer decides whether it goes live.
  const canSubmit = me.status !== "REJECTED" && me.status !== "INVITED";

  const payload = (): ArticleDraftInput => ({
    type, title: title.trim(), description: description.trim(), content,
    coverImageUrl: coverUrl, coverImageAlt: coverUrl ? coverAlt.trim() || null : null,
    relatedConditionSlug: medical ? condition : null, disclosure: disclosure.trim() || null, references: references.trim() || null,
  });

  const validate = (submit: boolean): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = "Add a title.";
    if (submit && !content.trim()) e.content = "Write some content before you submit.";
    return e;
  };

  // A chosen, dropped or pasted picture opens the crop window first.
  const pickCover = (file: File | undefined) => {
    if (!file || coverBusy || locked) return;
    try {
      checkImageFile(file);
      setErrors((e) => ({ ...e, cover: undefined }));
      setCropFile(file);
    } catch (err) {
      setErrors((e) => ({ ...e, cover: err instanceof ImageProblem ? err.message : messageOf(err) }));
    }
  };
  const uploadCover = async (make: () => Promise<File>, source: File) => {
    setCoverBusy(true);
    try {
      setCoverUrl(await contributorApi.uploadImage(await make()));
      setCoverSource(source);
      setErrors((e) => ({ ...e, cover: undefined }));
    } catch (err) {
      setErrors((e) => ({ ...e, cover: err instanceof ImageProblem ? err.message : messageOf(err) }));
    } finally {
      setCoverBusy(false);
    }
  };
  // Paste a picture (a screenshot, or one copied from another page) while the cover area is in focus.
  const pasteCover = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) { e.preventDefault(); pickCover(file); }
  };
  const dropCover = (e: React.DragEvent) => {
    e.preventDefault();
    setCoverOver(false);
    pickCover(e.dataTransfer.files[0]);
  };

  const save = async (submit: boolean) => {
    const e = validate(submit);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const saved = existing ? await contributorApi.updateArticle(existing.slug, payload()) : await contributorApi.createArticle(payload());
      if (submit) await contributorApi.submitArticle(saved.slug, true);
      setDirty(false);
      toast.success(submit
        ? (selfPublish ? "Published on Doctor Dekho." : medical ? "Sent for review. The team will assign a reviewing doctor." : "Sent for approval.")
        : existing?.status === "PUBLISHED" ? "Changes saved. They go live when you publish them." : "Draft saved. You can find it under My drafts.");
      // A saved draft is not sent to anyone: it waits under "My drafts" until the writer chooses Submit for review.
      router.push(submit ? (selfPublish ? "/contribute?tab=published" : "/contribute") : "/contribute?tab=drafts");
    } catch (err) {
      setErrors({ form: messageOf(err) });
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  // Submit for review first checks the article, then asks for the author's consent; only then is it saved and sent.
  const askToSubmit = () => {
    const e = validate(true);
    setErrors(e);
    if (Object.keys(e).length === 0) setAsking(true);
  };

  return (
    <form className={`${card} p-5 sm:p-8 space-y-6 max-w-5xl`} noValidate onSubmit={(ev) => { ev.preventDefault(); void save(false); }}>
      {existing?.returnedComment && <Banner tone="warn"><b>Changes requested:</b> {existing.returnedComment}</Banner>}
      {locked && <Banner tone="info">This article is {existing?.status === "IN_REVIEW" ? "in review" : "published"}, so it can no longer be edited here.</Banner>}

      <Field label="Article type" htmlFor="af-type" hint={medical ? "A verified doctor reviews it before it goes live." : "News and trends in the health sector. No medical advice. The team approves it."}>
        <select id="af-type" className={input} value={type} disabled={locked || writer} onChange={(e) => setType(e.target.value as ArticleType)}>
          {!writer && <option value="MEDICAL">{ARTICLE_TYPE_LABEL.MEDICAL}</option>}
          <option value="SECTOR_UPDATE">{ARTICLE_TYPE_LABEL.SECTOR_UPDATE}</option>
        </select>
      </Field>

      <Field label="Title" htmlFor="af-title" error={errors.title}>
        <input id="af-title" className={input} maxLength={300} value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} placeholder="Understanding Type 2 Diabetes" />
      </Field>
      <Field label="Short description" htmlFor="af-desc" optional hint="Shown on the article card and in search results.">
        <input id="af-desc" className={input} maxLength={1000} value={description} disabled={locked} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="space-y-1.5" onPaste={pasteCover}>
        <span className="block text-sm font-bold text-slate-800">Cover image <span className="font-normal text-slate-400">(optional)</span></span>
        <input ref={coverInput} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} />
        {coverUrl ? (
          <div className="grid sm:grid-cols-[14rem_1fr] gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded-xl border border-slate-200" />
            <div className="space-y-3">
              <Field label="Alt text" htmlFor="af-alt" optional hint="Helps people who use a screen reader. Add it if you can." error={errors.cover}>
                <input id="af-alt" className={input} maxLength={200} value={coverAlt} disabled={locked} onChange={(e) => setCoverAlt(e.target.value)} placeholder="Describe the image for screen readers" />
              </Field>
              <div className="flex gap-2">
                <button type="button" className={secondaryBtn} disabled={locked || coverBusy} onClick={() => coverInput.current?.click()}>{coverBusy ? "Uploading…" : "Replace"}</button>
                {coverSource && <button type="button" className={secondaryBtn} disabled={locked || coverBusy} onClick={() => setCropFile(coverSource)}>Crop and position</button>}
                <button type="button" className={secondaryBtn} disabled={locked} onClick={() => { setCoverUrl(null); setCoverAlt(""); setCoverSource(null); }}>Remove</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button" disabled={locked || coverBusy} onClick={() => coverInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setCoverOver(true); }} onDragLeave={() => setCoverOver(false)} onDrop={dropCover}
              className={`w-full border-2 border-dashed rounded-xl py-6 text-sm text-slate-500 hover:border-brand-teal hover:text-brand-teal disabled:opacity-60 flex flex-col items-center gap-1 ${coverOver ? "border-brand-teal bg-teal-50" : "border-slate-300"}`}
            >
              {coverBusy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-5 h-5" aria-hidden="true" />}
              <b className="text-slate-700">{coverBusy ? "Getting your picture ready…" : "Add a cover image"}</b>
              {!coverBusy && <span>Choose, drop or paste a picture. Big photos are made smaller for you. 16:9 works best.</span>}
            </button>
            {errors.cover && <p role="alert" className="text-xs font-medium text-red-600">{errors.cover}</p>}
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <span id="af-content-label" className="block text-sm font-bold text-slate-800">Content</span>
        <RichTextEditor initialMarkdown={existing?.content ?? ""} disabled={locked} labelledBy="af-content-label" onChange={setContent} />
        {errors.content && <p role="alert" className="text-xs font-medium text-red-600">{errors.content}</p>}
      </div>

      {medical && (
        <Field label="Related condition" htmlFor="af-cond" optional>
          <select id="af-cond" className={input} value={condition ?? ""} disabled={locked} onChange={(e) => setCondition(e.target.value || null)}>
            <option value="">None</option>{CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{SLUG_LABEL(c)}</option>)}
          </select>
        </Field>
      )}
      <Field label="References" htmlFor="af-refs" optional hint="One source per line. Shown at the end of the article.">
        <textarea id="af-refs" rows={3} className={input} value={references} disabled={locked} onChange={(e) => setReferences(e.target.value)} />
      </Field>
      <Field label="Disclosure" htmlFor="af-disc" optional hint="Any payment, employer or product link relevant to this article. If filled, it shows above the text.">
        <input id="af-disc" className={input} maxLength={300} value={disclosure} disabled={locked} onChange={(e) => setDisclosure(e.target.value)} />
      </Field>

      <Banner tone="info">
        {selfPublish
          ? "You are a verified doctor, so your article goes live as soon as you publish it. Nobody reviews it first, and every change is kept in its history. The NexEagle team can pull it back or take it down."
          : medical
          ? "After you submit, the NexEagle team assigns a reviewing doctor, who publishes it if it is right or tells you what to change. You get a WhatsApp message either way."
          : "After you submit, a NexEagle editor publishes it if it is right or tells you what to change. Sector updates must not give medical advice."}
      </Banner>
      {!canSubmit && !locked && (
        <Banner tone="warn">{me.status === "REJECTED" ? "Your profile was not accepted, so you cannot send articles. Contact the NexEagle team." : "Finish your profile to send articles for review."}</Banner>
      )}

      {errors.form && <p role="alert" className="text-sm font-medium text-red-600">{errors.form}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || locked} className={secondaryBtn}>{busy ? "Saving…" : "Save draft"}</button>
        <button type="button" disabled={busy || locked || !canSubmit} onClick={askToSubmit} className={primaryBtn}>{selfPublish ? (existing?.status === "PUBLISHED" ? "Publish changes" : "Publish") : "Submit for review"}</button>
        <Link href="/contribute" className="inline-flex items-center px-3 text-sm font-semibold text-slate-500 hover:text-brand-teal">Cancel</Link>
      </div>
      {cropFile && (
        <CoverCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onError={(message) => { setCropFile(null); setErrors((e) => ({ ...e, cover: message })); }}
          onApply={(cover) => { const original = cropFile; setCropFile(null); void uploadCover(async () => cover, original); }}
          onSkip={() => { const original = cropFile; setCropFile(null); void uploadCover(() => prepareImage(original), original); }}
        />
      )}
      <SubmitConsentDialog open={asking} medical={medical} busy={busy} selfPublish={selfPublish} onCancel={() => setAsking(false)} onConfirm={() => void save(true)} />
    </form>
  );
}
