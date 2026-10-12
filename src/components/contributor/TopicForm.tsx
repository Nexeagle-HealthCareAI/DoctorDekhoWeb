"use client";

import { useState } from "react";
import { CONDITION_OPTIONS, SLUG_LABEL } from "@/lib/contributor/conditions";
import { ARTICLE_TYPE_LABEL } from "@/lib/health-wiki/types";
import type { ArticleType, TopicInput } from "@/lib/contributor/types";
import { Field, input, primaryBtn, secondaryBtn } from "./ui";

type Errors = Partial<Record<"title" | "outline" | "whyItMatters" | "form", string>>;

interface Props {
  /** Writers can only suggest Sector updates. */
  sectorOnly: boolean;
  /** Doctors may ask the team to have someone else write the article, with the doctor as its reviewer. */
  canAskWriter?: boolean;
  submitLabel?: string;
  initial?: Partial<TopicInput>;
  onSubmit: (input: TopicInput) => Promise<void>;
  onCancel?: () => void;
}

export default function TopicForm({ sectorOnly, canAskWriter = false, submitLabel = "Send to the team", initial, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<ArticleType>(initial?.type ?? (sectorOnly ? "SECTOR_UPDATE" : "MEDICAL"));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [outline, setOutline] = useState(initial?.outline ?? "");
  const [why, setWhy] = useState(initial?.whyItMatters ?? "");
  const [condition, setCondition] = useState<string | null>(initial?.conditionSlug ?? null);
  const [references, setReferences] = useState(initial?.references ?? "");
  const [requestWriter, setRequestWriter] = useState(initial?.requestWriter ?? false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Errors = {};
    if (!title.trim()) e.title = "Name the topic.";
    if (!outline.trim()) e.outline = "Say what you would write about.";
    if (!why.trim()) e.whyItMatters = "Say why readers need it.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), type, outline: outline.trim(), whyItMatters: why.trim(), conditionSlug: type === "MEDICAL" ? condition : null, references: references.trim() || null, ...(canAskWriter ? { requestWriter } : {}) });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Type" htmlFor="tf-type">
        <select id="tf-type" className={input} value={type} disabled={sectorOnly} onChange={(e) => setType(e.target.value as ArticleType)}>
          {!sectorOnly && <option value="MEDICAL">{ARTICLE_TYPE_LABEL.MEDICAL}: a doctor reviews it</option>}
          <option value="SECTOR_UPDATE">{ARTICLE_TYPE_LABEL.SECTOR_UPDATE}: news and trends, no medical advice</option>
        </select>
      </Field>
      <Field label="Topic" htmlFor="tf-title" error={errors.title}>
        <input id="tf-title" className={input} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recognising a silent heart attack" />
      </Field>
      <Field label="What would you write about?" htmlFor="tf-outline" error={errors.outline} hint="A few lines on the main points.">
        <textarea id="tf-outline" rows={4} className={input} maxLength={2000} value={outline} onChange={(e) => setOutline(e.target.value)} />
      </Field>
      <Field label="Why does it matter?" htmlFor="tf-why" error={errors.whyItMatters}>
        <textarea id="tf-why" rows={3} className={input} maxLength={1000} value={why} onChange={(e) => setWhy(e.target.value)} />
      </Field>
      {type === "MEDICAL" && (
        <Field label="Related condition" htmlFor="tf-cond" optional>
          <select id="tf-cond" className={input} value={condition ?? ""} onChange={(e) => setCondition(e.target.value || null)}>
            <option value="">None</option>{CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{SLUG_LABEL(c)}</option>)}
          </select>
        </Field>
      )}
      <Field label="References" htmlFor="tf-refs" optional hint="Guidelines, studies or articles you would use.">
        <textarea id="tf-refs" rows={2} className={input} value={references} onChange={(e) => setReferences(e.target.value)} />
      </Field>
      {canAskWriter && (
        <label className="flex gap-3 items-start text-sm text-slate-700 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[hsl(var(--brand-teal))]" checked={requestWriter} disabled={!!initial?.requestWriter && !!initial?.title} onChange={(e) => setRequestWriter(e.target.checked)} />
          <span>
            <b className="text-slate-900">I would like someone else to write it.</b>{" "}
            The NexEagle team picks a writer, and you review the article before it goes live. Leave this empty if you want to write it yourself.
          </span>
        </label>
      )}
      {errors.form && <p role="alert" className="text-sm font-medium text-red-600">{errors.form}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? "Sending…" : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className={secondaryBtn}>Cancel</button>}
      </div>
    </form>
  );
}
