"use client";

import { useState } from "react";
import { SLUG_LABEL, slugifyCondition } from "@/lib/contributor/conditions";
import { Field, input } from "./ui";

const OTHER = "__other__";

interface Props {
  /** The condition the article is linked to (the stored name), or null. */
  value: string | null;
  options: string[];
  disabled?: boolean;
  onChange: (condition: string | null) => void;
}

/** The "Related condition" choice. When the condition is not in the list, the writer picks Other and types it. */
export default function ConditionField({ value, options, disabled, onChange }: Props) {
  // An article that already has a condition outside the list (written elsewhere) opens as Other, with that condition filled in.
  const outside = value !== null && !options.includes(value);
  const [other, setOther] = useState(outside);
  const [text, setText] = useState(outside ? SLUG_LABEL(value!) : "");

  const choose = (v: string) => {
    if (v === OTHER) { setOther(true); onChange(slugifyCondition(text) || null); return; }
    setOther(false);
    onChange(v || null);
  };
  const type = (t: string) => {
    setText(t);
    onChange(slugifyCondition(t) || null);
  };

  const typedButUnusable = other && text.trim() !== "" && slugifyCondition(text) === "";
  return (
    <div className="space-y-3">
      <Field label="Related condition" htmlFor="af-cond" optional hint="Used for the Find doctors card next to the article.">
        <select id="af-cond" className={input} value={other ? OTHER : value ?? ""} disabled={disabled} onChange={(e) => choose(e.target.value)}>
          <option value="">None</option>
          {options.map((c) => <option key={c} value={c}>{SLUG_LABEL(c)}</option>)}
          <option value={OTHER}>Other</option>
        </select>
      </Field>
      {other && (
        <Field
          label="Which condition?" htmlFor="af-cond-other"
          hint={slugifyCondition(text) ? `Saved as “${slugifyCondition(text)}”.` : "Type the condition, for example Knee pain. Leave it empty to link none."}
          error={typedButUnusable ? "Use English letters or numbers." : undefined}
        >
          <input id="af-cond-other" className={input} maxLength={60} value={text} disabled={disabled} onChange={(e) => type(e.target.value)} placeholder="For example: knee pain" />
        </Field>
      )}
    </div>
  );
}
