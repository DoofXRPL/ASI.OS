import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * A labelled control, and the two ways of grouping controls.
 *
 * The wiring matters more than the styling here: every control is named by its
 * label, described by its hint and its error, and marked invalid so the
 * announcement and the red border always agree. A field that looks wrong but
 * does not say so is a field only sighted visitors can fill in.
 */

/** Everything a control needs in order to be described correctly, in one place. */
export function describedBy(
  id: string,
  options: { hint?: boolean; error?: string | null },
): { "aria-describedby": string; "aria-invalid"?: true } {
  const ids = [
    options.error ? `${id}-error` : null,
    options.hint ? `${id}-hint` : null,
  ].filter((value): value is string => value !== null);

  return {
    // Always present, and always pointing at a live region that exists. An
    // aria-describedby that only appears once there is an error is announced
    // late by some screen readers, or not at all.
    "aria-describedby": ids.length > 0 ? ids.join(" ") : `${id}-error`,
    ...(options.error ? { "aria-invalid": true as const } : {}),
  };
}

export function SiteField({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  /** Matches the control's own id, which is what ties the three together. */
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-carbon">
          {label}
        </label>
        {hint ? (
          <span id={`${id}-hint`} className="text-[13px] text-mist">
            {hint}
          </span>
        ) : null}
      </div>

      {children}

      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * Takes no space when there is nothing to say.
 *
 * Polite rather than assertive: validation fires on blur while the visitor is
 * still moving through the form, and an assertive region would interrupt them
 * mid-field to describe the one they have just left.
 */
export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string | null;
}) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn("text-[13px]/5 text-danger", !message && "sr-only")}
    >
      {message ?? ""}
    </p>
  );
}

/** A titled run of fields, divided from what came before by a hairline. */
export function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("border-t border-edge pt-10", className)}>
      <h2 id={`${id}-title`} className="text-sm font-medium text-carbon">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-lg text-[13px]/5 text-mist">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * A set of radios, as the platform understands one.
 *
 * A real `<fieldset>` with a real `<legend>`, so the group is announced before
 * its options and arrow keys move between them — behaviour that has to be
 * rebuilt by hand the moment the radios stop being radios.
 */
export function ChoiceGroup({
  legend,
  error,
  errorId,
  children,
  className,
}: {
  legend: string;
  error?: string | null;
  errorId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      aria-describedby={errorId}
      aria-invalid={error ? true : undefined}
      className={cn("space-y-3", className)}
    >
      <legend className="sr-only">{legend}</legend>
      {children}
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
