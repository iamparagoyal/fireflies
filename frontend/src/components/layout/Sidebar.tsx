"use client";

import {
  BarChart3,
  CheckSquare,
  FileText,
  Home,
  Plug,
  Radio,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/cn";

import { Logo } from "./Logo";
import { useOpenNewMeeting } from "./NewMeetingContext";

const primary = [
  { href: "/meetings", label: "Meetings", icon: Home },
  { href: "/tasks", label: "Action Items", icon: CheckSquare },
  { href: "/search", label: "Search", icon: Search },
  { href: "/uploads", label: "Uploads", icon: FileText },
];

const secondary = [
  { href: "/live", label: "Live Notetaker", icon: Radio, soon: true },
  { href: "/integrations", label: "Integrations", icon: Plug, soon: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3, soon: true },
  { href: "/team", label: "Team", icon: Users, soon: true },
];

function NavLink({ href, label, icon: Icon, soon, onNavigate }: { href: string; label: string; icon: typeof Home; soon?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-nav-active text-nav-active-text" : "text-nav-muted hover:bg-nav-hover hover:text-nav-text",
      )}
    >
      <Icon className="size-[18px]" />
      <span className="flex-1">{label}</span>
      {soon && <span className="rounded-control bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nav-muted">Soon</span>}
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const openNewMeeting = useOpenNewMeeting();
  return (
    <nav className="flex h-full flex-col gap-1 bg-nav px-3 py-4 text-nav-text" aria-label="Main">
      <Link href="/meetings" className="mb-5 px-2" onClick={onNavigate}>
        <Logo />
      </Link>
      <button
        onClick={() => {
          onNavigate?.();
          openNewMeeting("upload");
        }}
        className="btn-primary mb-4 flex items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-medium transition"
      >
        <Upload className="size-4" /> Upload meeting
      </button>
      {primary.map((item) => (
        <NavLink key={item.href} {...item} onNavigate={onNavigate} />
      ))}
      <div className="mx-3 my-3 border-t border-white/10" />
      {secondary.map((item) => (
        <NavLink key={item.href} {...item} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto">
        <NavLink href="/settings" label="Settings" icon={Settings} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}
