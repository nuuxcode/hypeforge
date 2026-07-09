import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";

export const metadata: Metadata = {
  title: "A practical guide to giving compliments",
  description: "Simple guidance for giving specific compliments, receiving praise comfortably, and making appreciation feel sincere.",
  alternates: { canonical: "/compliment-guide" },
};

export default function ComplimentGuidePage() {
  const guideSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to give a meaningful compliment",
    description: "A practical three-step method for giving specific, sincere praise.",
    step: [
      { "@type": "HowToStep", name: "Notice a detail", text: "Name something the person actually did." },
      { "@type": "HowToStep", name: "Name the impact", text: "Explain what became easier, kinder, clearer, or better because of it." },
      { "@type": "HowToStep", name: "Keep it human", text: "Use specific words that sound like you." },
    ],
  };

  return (
    <main className="v2-shell min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideSchema) }} />
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
          <Link className="v2-display text-xl font-semibold v2-gradient-text" href="/v2">HypeForge</Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] px-3 text-sm font-bold text-[var(--text)] transition hover:bg-[var(--control-hover)]" href="/v2">
            Open generator
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </header>

        <article className="py-12 sm:py-16">
          <div className="grid size-12 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--coral)]">
            <HeartHandshake aria-hidden="true" className="size-6" />
          </div>
          <p className="v2-mono mt-6 text-xs uppercase text-[var(--purple-soft)]">A practical guide</p>
          <h1 className="v2-display mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[var(--text)] sm:text-5xl">Give praise that lands.</h1>
          <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-[var(--text-muted)]">
            The strongest compliment is not the grandest one. It notices a real choice, names the effect, and leaves room for the person to receive it.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel-raised)] p-6">
              <h2 className="v2-display text-2xl font-semibold text-[var(--text)]">When you give one</h2>
              <ol className="mt-5 space-y-5 text-base font-medium leading-7 text-[var(--text-muted)]">
                <li><strong className="text-[var(--text)]">Notice a detail.</strong> Name something they actually did, not only a trait you assume they have.</li>
                <li><strong className="text-[var(--text)]">Name the impact.</strong> Say what became easier, kinder, clearer, or better because of it.</li>
                <li><strong className="text-[var(--text)]">Keep it human.</strong> Specific words beat inflated praise when sincerity is the goal.</li>
              </ol>
            </section>
            <section className="rounded-[20px] border border-[var(--line)] bg-[var(--panel-raised)] p-6">
              <h2 className="v2-display text-2xl font-semibold text-[var(--text)]">When you receive one</h2>
              <ol className="mt-5 space-y-5 text-base font-medium leading-7 text-[var(--text-muted)]">
                <li><strong className="text-[var(--text)]">Let it land.</strong> A direct “thank you” is a complete response.</li>
                <li><strong className="text-[var(--text)]">Keep the evidence.</strong> Save the words that remind you of your impact on hard days.</li>
                <li><strong className="text-[var(--text)]">Pass it on.</strong> When you notice good work, return the generosity with something specific.</li>
              </ol>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
