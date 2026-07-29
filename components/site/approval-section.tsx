import { APPROVAL } from "@/lib/site/landing";
import { Reveal } from "./motion/reveal";
import { SectionHeading } from "./section-heading";
import { StatusTag } from "./status-tag";

/**
 * Human control as a product surface. The approval card is a specification
 * rendered as a figure — static chips, no dead buttons — and the copy leans on
 * the one mechanism that already exists in the design: the server, not the
 * model, decides what needs a person.
 */
export function ApprovalSection() {
  return (
    <section id="approvals" className="scroll-mt-16 border-b border-edge bg-wash">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-5">
          <SectionHeading
            eyebrow="Permission-based execution"
            aside={<StatusTag status={APPROVAL.status} label={APPROVAL.phase} />}
            title={APPROVAL.headline}
            lead={APPROVAL.body[0]}
          />
          <p className="mt-4 max-w-2xl text-[15px]/6 text-graphite">{APPROVAL.body[1]}</p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-md border border-edge bg-panel px-3.5 py-2.5">
            <span className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
              Default authority
            </span>
            <span className="font-mono text-xs font-medium text-carbon">
              {APPROVAL.defaultAuthority}
            </span>
          </div>
        </Reveal>

        <Reveal index={1} className="lg:col-span-7">
          <figure className="rounded-lg border border-edge bg-panel shadow-lift">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <p className="text-[13px] font-medium text-carbon">Approval checkpoint</p>
              <p className="font-mono text-[11px] text-mist">specification</p>
            </div>

            <dl>
              {APPROVAL.fields.map((field) => (
                <div
                  key={field.label}
                  className="grid gap-1 border-b border-edge px-4 py-2.5 sm:grid-cols-[9.5rem_1fr] sm:gap-4"
                >
                  <dt className="text-[13px] text-mist">{field.label}</dt>
                  <dd className="text-[13px]/5 text-graphite">{field.value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
              <span className="rounded-md bg-carbon px-3 py-1.5 text-[13px] font-medium text-white">
                {APPROVAL.verbs[0]}
              </span>
              <span className="rounded-md border border-edge-strong px-3 py-1.5 text-[13px] text-carbon">
                {APPROVAL.verbs[1]}
              </span>
              <span className="rounded-md border border-edge-strong px-3 py-1.5 text-[13px] text-graphite">
                {APPROVAL.verbs[2]}
              </span>
            </div>

            <figcaption className="border-t border-edge bg-wash px-4 py-2.5 text-xs/5 text-mist">
              A design target for the Phase 02 approval loop. The chips above are part of the
              specification, not working controls.
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
