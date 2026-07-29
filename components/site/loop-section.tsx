import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { LOOP_COPY } from "@/lib/site/landing";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/**
 * The six stages, each marked for what it is right now.
 *
 * The light travels the whole rail even though half the loop is not built, which
 * is the one place on this page where the design is allowed to run ahead of the
 * code — the stages themselves say plainly which of them it is passing through.
 */
export function LoopSection() {
  return (
    <section id="loop" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="The loop"
            title="Six stages, and the honest status of each"
            lead="Every surface in ASI OS names the stage it serves. A surface that cannot name its stage is decoration and does not ship — which is why there are five surfaces and not fifteen."
          />
        </Reveal>

        <Reveal delayMs={80} className="relative mt-14">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[5px] hidden h-px overflow-hidden bg-line lg:block"
          >
            <div className="h-px w-1/4 animate-trace bg-gradient-to-r from-transparent via-accent to-transparent" />
          </div>

          <ol className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
            {LOOP_COPY.map((stage, index) => {
              const running = stage.status === "running";

              return (
                <li key={stage.stage} className="relative">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block size-2.5 rounded-full ring-4 ring-void",
                      running ? "bg-accent" : "bg-line-strong",
                    )}
                  />

                  <p className="mt-5 font-mono text-[11px] text-ink-faint">
                    {String(index + 1).padStart(2, "0")}
                  </p>

                  <h3 className="mt-2 text-sm font-medium text-ink">{stage.stage}</h3>

                  <Badge
                    tone={running ? "confirmed" : "neutral"}
                    className={cn("mt-2", !running && "text-ink-faint")}
                  >
                    {running ? "Running" : "Designed, not built"}
                  </Badge>

                  <p className="mt-4 text-sm text-ink">{stage.claim}</p>
                  <p className="mt-2 text-xs/5 text-ink-muted">{stage.detail}</p>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
