import { initials } from "@/lib/health-wiki/format";
import type { ArticlePerson } from "@/lib/health-wiki/types";

const GRADIENTS = [
  "from-sky-500 to-indigo-500",
  "from-teal-500 to-sky-500",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-rose-500",
  "from-fuchsia-500 to-violet-500",
];

/** Photo when we have one, otherwise initials on a colour picked from the person's id. */
export default function PersonAvatar({ person, size = 48 }: { person: ArticlePerson; size?: number }) {
  const style = { width: size, height: size };
  if (person.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.photoUrl} alt="" width={size} height={size} style={style} className="rounded-full object-cover shadow-sm shrink-0" />;
  }
  const hash = person.id.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  return (
    <div
      aria-hidden="true"
      style={{ ...style, fontSize: size * 0.36 }}
      className={`rounded-full bg-gradient-to-br ${GRADIENTS[hash % GRADIENTS.length]} text-white flex items-center justify-center font-bold shrink-0`}
    >
      {initials(person.name)}
    </div>
  );
}
