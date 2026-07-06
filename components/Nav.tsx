"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const NAV: Array<{ href: string; label: string; icon: string; desc: string }> = [
  { href: "/", label: "Dashboard", icon: "◧", desc: "Health & savings" },
  { href: "/stats", label: "Statistics", icon: "▤", desc: "Usage & savings" },
  { href: "/projects", label: "Projects", icon: "▦", desc: "Index & configure" },
  { href: "/config", label: "Config", icon: "⚙", desc: "Global & project" },
  { href: "/hooks", label: "Hooks", icon: "⛓", desc: "Reindex hooks" },
  { href: "/deploy", label: "Deploy", icon: "▲", desc: "New machine" },
  { href: "/help", label: "Help", icon: "❔", desc: "Guide & config ref" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded text-[13px]",
                active ? "text-accent" : "text-faint group-hover:text-fg",
              )}
              aria-hidden
            >
              {item.icon}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{item.label}</span>
              <span className="text-[10.5px] text-faint">{item.desc}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
