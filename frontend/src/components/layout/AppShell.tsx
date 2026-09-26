"use client";

import { useCallback, useState } from "react";

import { NewMeetingModal } from "@/components/meetings/NewMeetingModal";

import { NewMeetingContext, type NewMeetingTab } from "./NewMeetingContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newMeetingTab, setNewMeetingTab] = useState<NewMeetingTab | null>(null);
  const openNewMeeting = useCallback((tab: NewMeetingTab = "upload") => setNewMeetingTab(tab), []);

  return (
    <NewMeetingContext.Provider value={openNewMeeting}>
      <div className="flex h-full">
        <aside className="no-print hidden w-[var(--sidebar-width)] shrink-0 border-r border-border bg-surface md:block">
          <Sidebar />
        </aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMenu={() => setMobileOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <NewMeetingModal tab={newMeetingTab} onClose={() => setNewMeetingTab(null)} onTabChange={setNewMeetingTab} />
    </NewMeetingContext.Provider>
  );
}
