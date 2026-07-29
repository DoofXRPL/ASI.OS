import { PREVIEW } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";

/**
 * The product preview — as a specification, not a screenshot.
 *
 * The panel is dark because the product is dark, and it is labelled a design
 * target because no live system renders it yet. Nothing inside is a working
 * control: actions are drawn as static chips inside a <figure>, so assistive
 * technology never meets a button that does nothing (ADR 0007).
 */
export function PreviewSection() {
  return (
    <section className="border-b border-edge bg-wash">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <Reveal>
          <figure className="overflow-hidden rounded-lg border border-line bg-void shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-3">
                <p className="text-[13px] font-medium text-ink">{PREVIEW.title}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                  {PREVIEW.phase}
                </span>
              </div>
              <p className="font-mono text-[11px] text-ink-faint">authority: advisory</p>
            </div>

            <div className="grid gap-px bg-line lg:grid-cols-5">
              <div className="bg-void p-5 lg:col-span-3">
                <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
                  Request
                </p>
                <p className="mt-3 rounded-md border border-line bg-surface px-3.5 py-3 text-sm/6 text-ink">
                  &ldquo;{PREVIEW.request}&rdquo;
                </p>

                <p className="mt-6 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
                  System process
                </p>
                <ol className="mt-3 space-y-0">
                  {PREVIEW.steps.map((step, index) => {
                    const last = index === PREVIEW.steps.length - 1;
                    return (
                      <li key={step} className="flex items-center gap-3 py-1.5">
                        <span
                          className={
                            last
                              ? "font-mono text-[11px] text-attention"
                              : "font-mono text-[11px] text-ink-faint"
                          }
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span
                          aria-hidden="true"
                          className={
                            last
                              ? "size-1.5 rounded-full bg-attention"
                              : "size-1.5 rounded-full bg-confirmed/70"
                          }
                        />
                        <span
                          className={
                            last ? "text-sm text-attention" : "text-sm text-ink-muted"
                          }
                        >
                          {step}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <span className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-void">
                    Approve
                  </span>
                  <span className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-ink">
                    Edit
                  </span>
                  <span className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-ink-muted">
                    Reject
                  </span>
                  <span className="ml-1 text-xs text-ink-faint">
                    Nothing executes until one of these is chosen.
                  </span>
                </div>
              </div>

              <div className="bg-void p-5 lg:col-span-2">
                <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
                  Metadata
                </p>
                <dl className="mt-3 space-y-3">
                  {PREVIEW.meta.map((item) => (
                    <div key={item.label} className="border-b border-line pb-3 last:border-b-0">
                      <dt className="text-xs text-ink-faint">{item.label}</dt>
                      <dd className="mt-0.5 font-mono text-xs text-ink-muted">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <figcaption className="border-t border-line bg-surface px-4 py-3 text-xs/5 text-ink-muted">
              {PREVIEW.caption}
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
