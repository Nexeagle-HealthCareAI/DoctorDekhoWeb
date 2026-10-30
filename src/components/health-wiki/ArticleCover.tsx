interface Props {
  src: string;
  alt: string;
  /** The first image on a page: load it right away. */
  priority?: boolean;
  className?: string;
}

/** 16:9 cover. The box keeps its shape while the image loads, so the page does not jump. */
export default function ArticleCover({ src, alt, priority = false, className = "" }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={1280}
      height={720}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={`w-full aspect-video object-cover bg-slate-100 ${className}`}
    />
  );
}
