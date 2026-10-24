"use client";

import Image from "next/image";
import { POSE } from "@/lib/vita/mood";

/** One pose of Vita the eagle. Decorative: the words beside it carry the meaning, so alt="" and
 * aria-hidden. Changing `mood` re-mounts the image and replays the short pop-in (none with reduced
 * motion, see globals.css). */
export default function Eagle({ mood, size, className = "" }: { mood: keyof typeof POSE; size: number; className?: string }) {
  return (
    <Image
      key={mood}
      src={POSE[mood]}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      data-mood={mood}
      className={`vita-pop shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
