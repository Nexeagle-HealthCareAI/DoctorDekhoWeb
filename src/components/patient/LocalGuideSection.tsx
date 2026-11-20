import type { LocalGuide } from "@/data/seo/localGuides";

/** The written guide under a speciality-in-a-town doctor list (see src/data/seo/localGuides.ts). */
export default function LocalGuideSection({ guide }: { guide: LocalGuide }) {
  return (
    <section className="border-t border-slate-200 bg-white py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-slate-700">
        <h2 className="text-xl font-bold text-slate-900">{guide.heading}</h2>
        <p className="mt-3 leading-relaxed">{guide.intro}</p>

        <h3 className="mt-6 text-base font-semibold text-slate-900">Problems a urologist treats</h3>
        <ul className="mt-2 space-y-2">
          {guide.conditions.map((c) => (
            <li key={c.name} className="leading-relaxed">
              <span className="font-medium text-slate-900">{c.name}.</span> {c.note}
            </li>
          ))}
        </ul>

        <h3 className="mt-6 text-base font-semibold text-slate-900">Do not wait for a routine appointment if you have</h3>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          {guide.seeSoon.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>

        <h3 className="mt-6 text-base font-semibold text-slate-900">What to bring to your first visit</h3>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          {guide.bring.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>

        <h3 className="mt-6 text-base font-semibold text-slate-900">Common questions</h3>
        <dl className="mt-2 space-y-3">
          {guide.faqs.map((f) => (
            <div key={f.q}>
              <dt className="font-medium text-slate-900">{f.q}</dt>
              <dd className="mt-1 leading-relaxed">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
