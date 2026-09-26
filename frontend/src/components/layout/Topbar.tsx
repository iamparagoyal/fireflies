"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, LogOut, Menu, Moon, Radio, Search, Settings, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { useMe } from "@/lib/queries";
import { useMounted } from "@/lib/useMounted";

const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-hover";
const menuContent = "z-50 min-w-52 rounded-lg border border-border bg-surface p-1 shadow-card";

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  return (
    <form
      role="search"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <label className="relative block">
        <span className="sr-only">Search across all meetings</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across all your meetings…"
          className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-sm outline-none transition placeholder:text-subtle focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20"
        />
      </label>
    </form>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { data: me } = useMe();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur">
      <IconButton label="Open menu" className="md:hidden" onClick={onOpenMenu}>
        <Menu className="size-5" />
      </IconButton>
      <GlobalSearch className="max-w-xl flex-1" />
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => toast.info("Live notetaker is coming soon", { description: "The bot that joins Zoom and Meet calls isn't part of this demo." })}
        >
          <Radio className="size-4 text-danger" /> Capture
        </Button>
        <IconButton label={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </IconButton>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton label="Notifications">
              <Bell className="size-[18px]" />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className={menuContent}>
              <div className="px-3 py-6 text-center text-sm text-muted">You&apos;re all caught up 🎉</div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="Account menu">
            <Avatar name={me?.user.name ?? "User"} color={me?.user.avatar_color} size="md" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className={menuContent}>
              <div className="border-b border-border px-2 pb-2 pt-1">
                <p className="text-sm font-semibold">{me?.user.name}</p>
                <p className="text-xs text-muted">{me?.user.email}</p>
              </div>
              <DropdownMenu.Item asChild className={menuItem}>
                <Link href="/settings">
                  <User className="size-4" /> Profile
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className={menuItem}>
                <Link href="/settings">
                  <Settings className="size-4" /> Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem} onSelect={() => toast.info("Authentication is mocked", { description: "You're always signed in as the demo user." })}>
                <LogOut className="size-4" /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
