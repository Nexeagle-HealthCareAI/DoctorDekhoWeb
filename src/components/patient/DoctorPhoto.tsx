"use client";

import { useState } from "react";
import Image from "next/image";

interface DoctorPhotoProps {
  photo?: string | null;
  name: string;
  initials: string;
  /** Tailwind gradient classes for the initials badge, as on the doctor record. */
  gradient: string;
  /** pixel size the image is requested at */
  size: number;
  quality?: number;
  /** classes for the photo itself and for the initials badge (so each screen keeps its own look) */
  imageClassName: string;
  fallbackClassName: string;
}

/**
 * A doctor's photo, or their initials when there is no photo OR the photo cannot be loaded (a deleted file or an unreachable store
 * gives a 404/400, which would otherwise leave a broken-image icon and the name written in a box).
 */
export default function DoctorPhoto({ photo, name, initials, gradient, size, quality, imageClassName, fallbackClassName }: DoctorPhotoProps) {
  const [failedFor, setFailedFor] = useState<string | null>(null);
  if (photo && failedFor !== photo) {
    return <Image src={photo} alt={name} width={size} height={size} quality={quality} onError={() => setFailedFor(photo)} className={imageClassName} />;
  }
  return (
    <div role="img" aria-label={name} className={`bg-gradient-to-br ${gradient} ${fallbackClassName}`}>
      {initials}
    </div>
  );
}
