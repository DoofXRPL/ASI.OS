"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/components/ui/cn";

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="md:px-2">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="shrink-0 md:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                  active
                    ? "bg-raised text-ink"
                    : "text-ink-muted hover:bg-raised/60 hover:text-ink",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-0.5 rounded-full",
                    active ? "bg-accent" : "bg-transparent",
                  )}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
