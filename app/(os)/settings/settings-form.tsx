"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { TIME_FORMATS, type TimeFormat } from "@/lib/schemas/settings";
import { saveSettingsAction } from "./actions";
import { EMPTY_SETTINGS_STATE, type SettingsFormState } from "./form-state";

export function SettingsForm({
  displayName,
  timezone,
  timeFormat,
  timezones,
}: {
  displayName: string | null;
  timezone: string;
  timeFormat: TimeFormat;
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(saveSettingsAction, EMPTY_SETTINGS_STATE);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.saved && !state.error ? (
        <Alert tone="confirmed">Saved.</Alert>
      ) : null}

      <Field
        label="Display name"
        htmlFor="displayName"
        hint="Used to greet you. Leave it empty and the greeting stays generic — ASI never guesses a name from your email address."
        error={state.fieldErrors?.displayName}
      >
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName ?? ""}
          maxLength={120}
          autoComplete="name"
        />
      </Field>

      <Field
        label="Time zone"
        htmlFor="timezone"
        hint="Every timestamp in ASI is rendered in this zone."
        error={state.fieldErrors?.timezone}
      >
        <Select id="timezone" name="timezone" defaultValue={timezone}>
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Clock format"
        htmlFor="timeFormat"
        error={state.fieldErrors?.timeFormat}
      >
        <Select id="timeFormat" name="timeFormat" defaultValue={timeFormat}>
          {TIME_FORMATS.map((format) => (
            <option key={format} value={format}>
              {format === "24h" ? "24-hour" : "12-hour"}
            </option>
          ))}
        </Select>
      </Field>

      <Button
        type="submit"
        variant="primary"
        pending={pending}
        pendingLabel="Saving…"
      >
        Save changes
      </Button>
    </form>
  );
}
