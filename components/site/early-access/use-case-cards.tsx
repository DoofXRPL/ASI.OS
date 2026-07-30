"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  Check,
  CircleDashed,
  CodeXml,
  Landmark,
  Library,
  ListChecks,
  Microscope,
  Network,
  type LucideIcon,
} from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/components/ui/cn";
import { USE_CASE_OPTIONS, type UseCase } from "@/lib/schemas/early-access";

/**
 * The primary use case, as cards rather than a select.
 *
 * Each card is a real `<input type="radio">` with its label wrapped around it,
 * so the group keeps everything the platform gives a radio group for free:
 * arrow-key navigation, a single tab stop, correct announcement, and a value
 * that submits without JavaScript. The card is the label's styling; nothing
 * here reimplements a control.
 *
 * The icon is a mnemonic, never a status, so it carries no colour of its own —
 * it moves with the text from mist to carbon as the card is chosen.
 */
const ICONS: Record<UseCase, LucideIcon> = {
  personal_productivity: ListChecks,
  software_development: CodeXml,
  ai_agents: Bot,
  knowledge_management: Library,
  business_operations: Network,
  finance: Landmark,
  research: Microscope,
  other: CircleDashed,
};

export function UseCaseCards({
  selected,
  registration,
}: {
  selected: UseCase | "";
  /** The field's `name`, `ref` and handlers, spread onto every radio. */
  registration: UseFormRegisterReturn<"useCase">;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {USE_CASE_OPTIONS.map((option) => {
        const Icon = ICONS[option.value];
        const isSelected = selected === option.value;

        return (
          <label
            key={option.value}
            className={cn(
              "group relative flex cursor-pointer gap-3 rounded-xl border p-4",
              "transition-[border-color,background-color,box-shadow,transform]",
              "duration-[var(--duration-hover)] ease-[var(--ease-out)]",
              // Focus lands on the visually hidden radio, so the card wears it.
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
              "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
              isSelected
                ? "border-carbon bg-carbon/[0.035] shadow-lift"
                : "border-edge bg-panel hover:-translate-y-px hover:border-edge-strong hover:shadow-lift",
            )}
          >
            <input
              {...registration}
              type="radio"
              value={option.value}
              checked={isSelected}
              className="sr-only"
            />

            <Icon
              aria-hidden="true"
              strokeWidth={1.5}
              className={cn(
                "mt-px size-[18px] shrink-0",
                "transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                isSelected ? "text-carbon" : "text-mist group-hover:text-graphite",
              )}
            />

            <span className="min-w-0 flex-1">
              <span className="block pr-6 text-sm font-medium text-carbon">
                {option.label}
              </span>
              <span className="mt-1 block text-[13px]/5 text-mist">
                {option.description}
              </span>
            </span>

            {/*
             * The tick is confirmation of a choice already visible in the
             * border and the tint, so it is decoration in the strict sense —
             * hence aria-hidden. The radio itself carries the checked state.
             */}
            <AnimatePresence initial={false}>
              {isSelected ? (
                <motion.span
                  aria-hidden="true"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-3.5 right-3.5 flex size-[18px] items-center justify-center rounded-full bg-carbon"
                >
                  <Check className="size-3 text-white" strokeWidth={3} />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </label>
        );
      })}
    </div>
  );
}
