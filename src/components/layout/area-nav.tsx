"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function AreaNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // O item mais específico que casa com a rota atual fica ativo.
  const active = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="-mx-4 overflow-x-auto border-b px-4">
      <ul className="flex gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold",
                active === item.href
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
