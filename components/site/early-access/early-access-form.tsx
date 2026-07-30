"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { useActionState, useId, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { SiteInput, SiteTextarea } from "@/components/site/form/control";
import {
  ChoiceGroup,
  describedBy,
  FormSection,
  SiteField,
} from "@/components/site/form/field";
import { cn } from "@/components/ui/cn";
import { requestEarlyAccessAction } from "@/lib/early-access/actions";
import {
  EMPTY_EARLY_ACCESS_STATE,
  type EarlyAccessFormState,
} from "@/lib/early-access/form-state";
import {
  earlyAccessRequestSchema,
  EMPTY_FORM_VALUES,
  type EarlyAccessField,
  type EarlyAccessFormValues,
  type EarlyAccessRequest,
} from "@/lib/schemas/early-access";
import { EARLY_ACCESS } from "@/lib/site/early-access";
import { MOTION } from "@/lib/site/motion";
import { SuccessPanel } from "./success-panel";
import { TeamSizeChoice } from "./team-size-choice";
import { UseCaseCards } from "./use-case-cards";

/**
 * The request form.
 *
 * Two validators, one schema. React Hook Form runs it in the browser so a
 * mistake is caught beside the field that caused it; the server action runs it
 * again on the submission it actually receives, because the form is a
 * convenience and the server is the boundary.
 *
 * It still works with JavaScript disabled. `action` is the server action, so a
 * plain browser submit posts and re-renders with whatever the server decided.
 * Once hydrated, `onSubmit` validates first and then calls the same action by
 * hand — one code path, two levels of enhancement.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

/** Kept out of the schema: no genuine submission ever contains it. */
const HONEYPOT_FIELD = "asi_hp";

export function EarlyAccessForm() {
  const [state, formAction, pending] = useActionState<EarlyAccessFormState, FormData>(
    requestEarlyAccessAction,
    EMPTY_EARLY_ACCESS_STATE,
  );

  const form = useForm<EarlyAccessFormValues, unknown, EarlyAccessRequest>({
    resolver: zodResolver(earlyAccessRequestSchema),
    // `state.values` is only ever set on the unhydrated path, where a
    // rejection arrives as a fresh page and the alternative is an empty form.
    defaultValues: state.values ?? EMPTY_FORM_VALUES,
    // Quiet until you leave a field, then immediate once it has been
    // corrected. Validating on every keystroke tells someone their address is
    // invalid while they are still typing the domain.
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const reduceMotion = useReducedMotion() ?? false;
  const ids = useFieldIds();

  // `useWatch` rather than `form.watch`: it subscribes to one field instead of
  // re-rendering the whole form on every keystroke anywhere in it.
  const useCase = useWatch({ control: form.control, name: "useCase" });
  const teamSize = useWatch({ control: form.control, name: "teamSize" });

  /**
   * The client's complaint where there is one, the server's otherwise. A
   * submission rejected without JavaScript has no client-side error to show,
   * and one rejected after hydration was caught here before it was sent.
   */
  const errorFor = (field: EarlyAccessField): string | undefined =>
    form.formState.errors[field]?.message ?? state.fieldErrors?.[field];

  const rejectedFields = Object.keys(state.fieldErrors ?? {}).length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Read synchronously: React clears `currentTarget` once this handler
    // returns, and the validation below is asynchronous.
    const submitted = new FormData(event.currentTarget);

    void form.handleSubmit(
      () => formAction(submitted),
      // Invalid. React Hook Form has already moved focus to the first field
      // that failed, which is the only thing left to do.
      () => undefined,
    )(event);
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state.status === "recorded" ? (
        <SuccessPanel key="recorded" />
      ) : (
        <motion.div
          key="form"
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE }}
        >
          <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-10">
            {state.error ? (
              <FormNotice tone={state.status === "unavailable" ? "attention" : "danger"}>
                {state.error}
              </FormNotice>
            ) : rejectedFields ? (
              <FormNotice tone="danger">
                Some answers need another look. They are marked below.
              </FormNotice>
            ) : null}

            <div className="space-y-6">
              <SiteField id={ids.name} label={EARLY_ACCESS.labels.name} error={errorFor("name")}>
                <SiteInput
                  {...form.register("name")}
                  {...describedBy(ids.name, { error: errorFor("name") })}
                  id={ids.name}
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  enterKeyHint="next"
                />
              </SiteField>

              <SiteField id={ids.email} label={EARLY_ACCESS.labels.email} error={errorFor("email")}>
                <SiteInput
                  {...form.register("email")}
                  {...describedBy(ids.email, { error: errorFor("email") })}
                  id={ids.email}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  enterKeyHint="next"
                />
              </SiteField>

              <SiteField
                id={ids.company}
                label={EARLY_ACCESS.labels.company}
                hint={EARLY_ACCESS.labels.companyHint}
                error={errorFor("company")}
              >
                <SiteInput
                  {...form.register("company")}
                  {...describedBy(ids.company, { hint: true, error: errorFor("company") })}
                  id={ids.company}
                  autoComplete="organization"
                  placeholder="Where you work, if it matters here"
                />
              </SiteField>
            </div>

            <FormSection
              id={ids.useCase}
              title={EARLY_ACCESS.sections.useCase.title}
              description={EARLY_ACCESS.sections.useCase.description}
            >
              <ChoiceGroup
                legend={EARLY_ACCESS.sections.useCase.title}
                error={errorFor("useCase")}
                errorId={`${ids.useCase}-error`}
              >
                <UseCaseCards selected={useCase} registration={form.register("useCase")} />
              </ChoiceGroup>

              <AnimatePresence initial={false}>
                {useCase === "other" ? (
                  <motion.div
                    key="other"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="pt-5">
                      <SiteField
                        id={ids.otherUseCase}
                        label={EARLY_ACCESS.labels.otherUseCase}
                        error={errorFor("otherUseCase")}
                      >
                        <SiteTextarea
                          {...form.register("otherUseCase")}
                          {...describedBy(ids.otherUseCase, {
                            error: errorFor("otherUseCase"),
                          })}
                          id={ids.otherUseCase}
                          rows={3}
                        />
                      </SiteField>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </FormSection>

            <FormSection
              id={ids.context}
              title={EARLY_ACCESS.sections.context.title}
              description={EARLY_ACCESS.sections.context.description}
            >
              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-carbon">
                    {EARLY_ACCESS.labels.teamSize}
                  </p>
                  <ChoiceGroup
                    legend={EARLY_ACCESS.labels.teamSize}
                    error={errorFor("teamSize")}
                    errorId={`${ids.teamSize}-error`}
                  >
                    <TeamSizeChoice
                      selected={teamSize}
                      registration={form.register("teamSize")}
                    />
                  </ChoiceGroup>
                </div>

                <SiteField
                  id={ids.challenge}
                  label={EARLY_ACCESS.labels.challenge}
                  error={errorFor("challenge")}
                >
                  <SiteTextarea
                    {...form.register("challenge")}
                    {...describedBy(ids.challenge, { error: errorFor("challenge") })}
                    id={ids.challenge}
                    rows={4}
                    placeholder={EARLY_ACCESS.labels.challengePlaceholder}
                  />
                </SiteField>
              </div>
            </FormSection>

            {/*
             * Hidden from everyone who is not a script: off-screen rather than
             * `display: none`, which some bots skip, and out of both the tab
             * order and the accessibility tree so no person can reach it.
             */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor={ids.honeypot}>Leave this field empty</label>
              <input
                id={ids.honeypot}
                name={HONEYPOT_FIELD}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </div>

            <SubmitButton pending={pending} reduceMotion={reduceMotion} />

            <p className="text-[13px]/6 text-mist">{EARLY_ACCESS.privacy}</p>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Amber where the system is at fault, red where the submission was refused. */
function FormNotice({
  tone,
  children,
}: {
  tone: "attention" | "danger";
  children: React.ReactNode;
}) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-[13px]/6 text-carbon",
        tone === "attention"
          ? "border-attention-ink/25 bg-attention-ink/[0.06]"
          : "border-danger/35 bg-danger/[0.06]",
      )}
    >
      {children}
    </p>
  );
}

function SubmitButton({
  pending,
  reduceMotion,
}: {
  pending: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      whileTap={reduceMotion || pending ? undefined : { scale: 0.995 }}
      transition={{ duration: MOTION.durationHoverMs / 1000, ease: EASE }}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2.5 rounded-lg",
        "bg-carbon text-[15px] font-medium text-white",
        "transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)]",
        "hover:bg-carbon/85 disabled:cursor-not-allowed disabled:bg-carbon/55",
      )}
    >
      {pending ? (
        <>
          {/*
           * The stylesheet flattens every animation under reduced motion, so
           * this can stop turning. The label is the real progress report and
           * stays either way.
           */}
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {EARLY_ACCESS.submitPending}
        </>
      ) : (
        EARLY_ACCESS.submit
      )}
    </motion.button>
  );
}

/**
 * Stable, unique ids for every control.
 *
 * `useId` rather than hard-coded strings, so the form could appear twice on a
 * page without two labels pointing at one input — a duplicate id is invisible
 * until a screen reader announces the wrong field.
 */
function useFieldIds() {
  const prefix = useId();
  return {
    name: `${prefix}-name`,
    email: `${prefix}-email`,
    company: `${prefix}-company`,
    useCase: `${prefix}-use-case`,
    otherUseCase: `${prefix}-other-use-case`,
    context: `${prefix}-context`,
    teamSize: `${prefix}-team-size`,
    challenge: `${prefix}-challenge`,
    honeypot: `${prefix}-hp`,
  };
}
