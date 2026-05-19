"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type SidebarProps = {
  items: NavItem[];
};

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-[var(--line)] bg-[var(--panel)] hidden sm:block">
      <nav className="flex flex-col gap-1 p-4">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--teal)]/10 text-[var(--teal)]"
                  : "text-[var(--muted)] hover:bg-background hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
