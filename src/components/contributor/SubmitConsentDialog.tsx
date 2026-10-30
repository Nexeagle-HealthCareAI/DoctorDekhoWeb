"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { primaryBtn, secondaryBtn } from "./ui";

interface Props {
  open: boolean;
  /** MEDICAL goes to a doctor; a sector update goes to a NexEagle editor. */
  medical: boolean;
  busy: boolean;
  /** A verified doctor publishes their own article at once, with no review. */
  selfPublish?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asked when the author chooses Submit for review: who reads it, what happens next, and the author's consent. */
export default function SubmitConsentDialog({ open, medical, busy, selfPublish = false, onCancel, onConfirm }: Props) {
  const [agreed, setAgreed] = useState(false);
  useEffect(() => { if (open) setAgreed(false); }, [open]);

  const reviewer = medical ? "reviewing doctor" : "NexEagle editor";
  if (selfPublish) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish this article now?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600 text-left">
                <p>As a verified doctor you can publish without a review. Your article goes live on Doctor Dekho at once.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>It is shown under your name{medical ? ", without a \"Medically reviewed by\" badge, because nobody else reviewed it" : ""}.</li>
                  <li>Every change you publish is kept in the article history.</li>
                  <li>The NexEagle team can pull it back to review or take it down if something is wrong.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <label className="flex gap-3 items-start text-sm text-slate-800 cursor-pointer">
            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[hsl(var(--brand-teal))]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I have checked this article and I am responsible for what it says.</span>
          </label>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className={secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className={primaryBtn} onClick={onConfirm} disabled={!agreed || busy}>{busy ? "Publishing…" : "Publish now"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send this article for review?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-slate-600 text-left">
              <p>
                {medical
                  ? "Your article goes to the reviewing doctor the NexEagle team assigns."
                  : "Your article goes to a NexEagle editor."}{" "}
                The {reviewer} will read it.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>If everything is right, the {reviewer} will publish it on Doctor Dekho.</li>
                <li>If something needs to change, they will tell you what to fix, and you can edit and send it again.</li>
              </ul>
              <p>You get a WhatsApp message when it is published or sent back.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <label className="flex gap-3 items-start text-sm text-slate-800 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[hsl(var(--brand-teal))]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I agree that the {reviewer} may publish this article on Doctor Dekho if it is correct.</span>
        </label>
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className={secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={primaryBtn} onClick={onConfirm} disabled={!agreed || busy}>{busy ? "Sending…" : "Send for review"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
