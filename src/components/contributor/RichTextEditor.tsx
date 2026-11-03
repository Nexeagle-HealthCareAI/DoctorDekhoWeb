"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import { Bold, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Quote, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { contributorApi } from "@/lib/contributor/client";
import { messageOf } from "@/lib/contributor/hooks";
import { IMAGE_ACCEPT, ImageProblem, prepareImage } from "@/lib/contributor/prepareImage";
import { input, primaryBtn, secondaryBtn } from "./ui";

interface Props {
  /** Markdown to start from. Read once when the editor mounts. */
  initialMarkdown: string;
  disabled?: boolean;
  onChange: (markdown: string) => void;
  /** Id of the element that labels the editor. */
  labelledBy: string;
}

/** Rich-text editor that saves markdown. Loaded without server rendering (it needs the browser). */
export default function RichTextEditor({ initialMarkdown, disabled, onChange, labelledBy }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  // The picture just added: where it sits in the text, and the description being typed for it (optional).
  const [added, setAdded] = useState<{ pos: number; src: string } | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  // The picture handler is needed by the editor's own paste and drop handling, which is set up before the editor exists.
  const addPicture = useRef<(file: File) => void>(() => undefined);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: false } }), Image, Markdown],
    content: initialMarkdown,
    contentType: "markdown",
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
    editorProps: {
      // A picture pasted or dropped into the text is added there, like a picture chosen with the button.
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        addPicture.current(file);
        return true;
      },
      handleDrop: (_view, event) => {
        const file = Array.from((event as DragEvent).dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        addPicture.current(file);
        return true;
      },
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
  // Make the picture small enough, upload it, and put it in the text at once. Describing it for screen readers can follow, or be skipped.
  const pickImage = async (file: File | undefined) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const src = await contributorApi.uploadImage(await prepareImage(file));
      editor.chain().focus().setImage({ src, alt: "" }).run();
      // Where it landed (an image can take the place of an empty paragraph, so the cursor position is not it).
      let pos = -1;
      editor.state.doc.descendants((node, at) => { if (pos < 0 && node.type.name === "image" && node.attrs.src === src) pos = at; });
      if (pos >= 0) { setAdded({ pos, src }); setAlt(""); }
    } catch (e) {
      toast.error(e instanceof ImageProblem ? e.message : messageOf(e));
    } finally {
      setUploading(false);
    }
  };
  addPicture.current = (file) => void pickImage(file);
  const saveAlt = () => {
    if (added) {
      const node = editor.state.doc.nodeAt(added.pos);
      if (node?.type.name === "image" && node.attrs.src === added.src) editor.view.dispatch(editor.state.tr.setNodeMarkup(added.pos, undefined, { ...node.attrs, alt: alt.trim() }));
    }
    setAdded(null);
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
        <label className={cn(tb(false), "cursor-pointer", (off || uploading) && "opacity-40 cursor-not-allowed")} title="Insert image" aria-label="Insert image">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="w-4 h-4" aria-hidden="true" />}
          <input type="file" accept={IMAGE_ACCEPT} hidden disabled={off || uploading} onChange={(e) => { void pickImage(e.target.files?.[0]); e.target.value = ""; }} />
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

      {uploading && <p className="px-3 py-2 text-xs text-slate-600 border-b border-slate-200 bg-slate-50" role="status">Getting your picture ready…</p>}
      {added && (
        <div className="flex flex-wrap items-end gap-3 p-3 border-b border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={added.src} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
          <div className="flex-1 min-w-[12rem] space-y-1">
            <label htmlFor="rte-alt" className="block text-xs font-bold text-slate-700">Picture added. Describe it for screen readers <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="rte-alt" className={input} placeholder="What the picture shows" maxLength={200} value={alt} onChange={(e) => setAlt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveAlt())} />
          </div>
          <button type="button" className={`${primaryBtn} !py-2`} onClick={saveAlt}>{alt.trim() ? "Save" : "Done"}</button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
