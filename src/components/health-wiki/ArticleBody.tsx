import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Article text is written by outside contributors, so it is never trusted. react-markdown builds
// React elements (no innerHTML), rehype-sanitize drops anything outside a small allow-list, and
// images and links are limited to https. A <script>, an onerror handler or a javascript: link in
// the source simply does not reach the page.
const schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: ["http", "https", "mailto"], src: ["https"] },
};

const isLocalOrHttps = (src: string) => src.startsWith("/") ? !src.startsWith("//") : src.startsWith("https://");

const components: Components = {
  // The page title is the only h1. A "# Heading" in an article becomes a second-level heading.
  h1: ({ node: _node, ...props }) => <h2 {...props} />,
  a: ({ node: _node, href, children }) => {
    const external = !!href && /^https?:\/\//.test(href);
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}>
        {children}
      </a>
    );
  },
  img: ({ node: _node, src, alt }) =>
    typeof src === "string" && isLocalOrHttps(src) ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className="w-full rounded-2xl border border-slate-100" />
    ) : null,
};

export default function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div
      className="prose prose-slate max-w-none prose-headings:font-display prose-headings:font-bold prose-h2:text-2xl prose-h2:text-slate-900 prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2 prose-h3:text-lg prose-h3:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-strong:text-slate-900 prose-a:text-brand-teal prose-a:font-semibold prose-blockquote:border-brand-teal prose-blockquote:text-slate-600 prose-img:my-6"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
