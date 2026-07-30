"use client";

import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/components/ui/cn";
import { TEAM_SIZE_OPTIONS, type TeamSizeAnswer } from "@/lib/schemas/early-access";

/**
 * Team size, as four radios on one line.
 *
 * Optional, and it stays optional: there is no "prefer not to say" option
 * because leaving all four unselected already means that, and an explicit
 * choice to decline would only make the silence look like a mistake.
 */
export function TeamSizeChoice({
  selected,
  registration,
}: {
  selected: TeamSizeAnswer;
  registration: UseFormRegisterReturn<"teamSize">;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TEAM_SIZE_OPTIONS.map((option) => {
        const isSelected = selected === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-lg border px-4 py-2.5 text-sm",
              "transition-[border-color,background-color,color] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
              "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
              isSelected
                ? "border-carbon bg-carbon/[0.035] font-medium text-carbon"
                : "border-edge bg-panel text-graphite hover:border-edge-strong hover:text-carbon",
            )}
          >
            <input
              {...registration}
              type="radio"
              value={option.value}
              checked={isSelected}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
