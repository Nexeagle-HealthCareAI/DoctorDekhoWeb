"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { Bold, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { contributorApi } from "@/lib/contributor/client";
import { messageOf } from "@/lib/contributor/hooks";
import { input, primaryBtn, secondaryBtn } from "./ui";

interface Props {
  /** Markdown to start from. Read once when the editor mounts. */
  initialMarkdown: string;
  disabled?: boolean;
  onChange: (markdown: string) => void;
  /** Id of the element that labels the editor. */
  labelledBy: string;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/** Rich-text editor that saves markdown. Loaded without server rendering (it needs the browser). */
export default function RichTextEditor({ initialMarkdown, disabled, onChange, labelledBy }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: false } }), Image, Markdown],
    content: initialMarkdown,
    contentType: "markdown",
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
    editorProps: {
      attributes: {
        role: "textbox", "aria-multiline": "true", "aria-labelledby": labelledBy,
        class: "prose prose-slate max-w-none min-h-[18rem] px-4 py-3 focus:outline-none prose-headings:font-display prose-h2:text-xl prose-h3:text-lg prose-p:text-slate-700 prose-li:text-slate-700 prose-a:text-brand-teal",
      },
    },
  });

  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false, italic: e?.isActive("italic") ?? false, bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false, quote: e?.isActive("blockquote") ?? false, link: e?.isActive("link") ?? false,
      block: e?.isActive("heading", { level: 2 }) ? "h2" : e?.isActive("heading", { level: 3 }) ? "h3" : "p",
      canUndo: e?.can().undo() ?? false, canRedo: e?.can().redo() ?? false,
    }),
  });

  if (!editor || !s) return <div className="h-72 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" aria-label="Loading editor" />;

  const setBlock = (v: string) => {
    const c = editor.chain().focus();
    if (v === "p") c.setParagraph().run(); else c.setHeading({ level: v === "h2" ? 2 : 3 }).run();
  };
  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().unsetLink().run();
    else if (!/^https?:\/\//i.test(url)) return setLinkError("Start the address with https://");
    else editor.chain().focus().setLink({ href: url }).run();
    setLinkOpen(false);
  };
  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return void toast.error("Use a JPG, PNG or WebP file.");
    if (file.size > MAX_BYTES) return void toast.error("That file is over 2 MB.");
    try {
      setPending(await contributorApi.uploadImage(file));
      setAlt("");
    } catch (e) {
      toast.error(messageOf(e));
    }
  };
  const insertImage = () => {
    if (!pending) return;
    editor.chain().focus().setImage({ src: pending, alt: alt.trim() }).run();
    setPending(null);
  };

  const tb = (active: boolean) => cn("p-2 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal", active && "bg-teal-50 text-brand-teal");
  const off = !!disabled;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-brand-teal focus-within:ring-2 focus-within:ring-brand-teal/20">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 p-1.5 border-b border-slate-200 bg-slate-50">
        <select aria-label="Text style" value={s.block} disabled={off} onChange={(e) => setBlock(e.target.value)} className="text-sm rounded-lg border border-slate-200 bg-white px-2 py-1.5">
          <option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        <span className="w-px h-6 bg-slate-200 mx-1" aria-hidden="true" />
        <button type="button" className={tb(s.bold)} title="Bold" aria-label="Bold" aria-pressed={s.bold} disabled={off} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></button>
        <button type="button" className={tb(s.italic)} title="Italic" aria-label="Italic" aria-pressed={s.italic} disabled={off} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></button>
        <button type="button" className={tb(s.bullet)} title="Bullet list" aria-label="Bullet list" aria-pressed={s.bullet} disabled={off} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></button>
        <button type="button" className={tb(s.ordered)} title="Numbered list" aria-label="Numbered list" aria-pressed={s.ordered} disabled={off} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></button>
        <button type="button" className={tb(s.quote)} title="Quote" aria-label="Quote" aria-pressed={s.quote} disabled={off} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></button>
        <button type="button" className={tb(s.link)} title="Link" aria-label="Link" aria-pressed={s.link} disabled={off} onClick={() => { setLinkUrl((editor.getAttributes("link").href as string) || ""); setLinkError(""); setLinkOpen(true); }}><Link2 className="w-4 h-4" /></button>
        <label className={cn(tb(false), "cursor-pointer", off && "opacity-40 cursor-not-allowed")} title="Insert image" aria-label="Insert image">
          <ImagePlus className="w-4 h-4" />
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={off} onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <span className="w-px h-6 bg-slate-200 mx-1" aria-hidden="true" />
        <button type="button" className={tb(false)} title="Undo" aria-label="Undo" disabled={off || !s.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></button>
        <button type="button" className={tb(false)} title="Redo" aria-label="Redo" disabled={off || !s.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></button>
      </div>

      {linkOpen && (
        <div className="flex flex-wrap items-end gap-3 p-3 border-b border-slate-200 bg-slate-50">
          <div className="flex-1 min-w-[12rem] space-y-1">
            <label htmlFor="rte-link" className="block text-xs font-bold text-slate-700">Link address</label>
            <input id="rte-link" className={input} placeholder="https://" value={linkUrl} autoFocus onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyLink())} />
            {linkError && <p role="alert" className="text-xs font-medium text-red-600">{linkError}</p>}
          </div>
          <button type="button" className={`${primaryBtn} !py-2`} onClick={applyLink}>Apply</button>
          <button type="button" className={`${secondaryBtn} !py-2`} onClick={() => setLinkOpen(false)}>Cancel</button>
        </div>
      )}

      {pending && (
        <div className="flex flex-wrap items-end gap-3 p-3 border-b border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
          <div className="flex-1 min-w-[12rem] space-y-1">
            <label htmlFor="rte-alt" className="block text-xs font-bold text-slate-700">Alt text <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="rte-alt" className={input} placeholder="What the image shows, for screen readers" maxLength={200} value={alt} autoFocus onChange={(e) => setAlt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), insertImage())} />
          </div>
          <button type="button" className={`${primaryBtn} !py-2`} onClick={insertImage}>Insert</button>
          <button type="button" className={`${secondaryBtn} !py-2`} onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
