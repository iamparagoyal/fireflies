"use client";

import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/components/ui/cn";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import { useActionItems } from "@/lib/queries";
import type { ActionItemWithMeeting } from "@/lib/types";

type Filter = "open" | "done" | "all";

export function filterTasks(items: ActionItemWithMeeting[], filter: Filter) {
  if (filter === "open") return items.filter((i) => !i.is_completed);
  if (filter === "done") return items.filter((i) => i.is_completed);
  return items;
}

export function TasksView() {
  const { data, error, isLoading, mutate } = useActionItems();
  const [filter, setFilter] = useState<Filter>("open");
  const items = filterTasks(data ?? [], filter);
  const counts = { open: data?.filter((i) => !i.is_completed).length ?? 0, done: data?.filter((i) => i.is_completed).length ?? 0, all: data?.length ?? 0 };

  const toggle = async (item: ActionItemWithMeeting) => {
    const optimistic = (data ?? []).map((i) => (i.id === item.id ? { ...i, is_completed: !i.is_completed } : i));
    await mutate(optimistic, { revalidate: false });
    try {
      await api.updateActionItem(item.id, { is_completed: !item.is_completed });
      if (!item.is_completed) toast.success("Marked as done", { description: item.text });
      await mutate();
    } catch (err) {
      await mutate();
      toast.error(err instanceof Error ? err.message : "Could not update action item");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">Action Items</h1>
      <p className="mt-0.5 text-sm text-muted">Tasks extracted from all of your meetings</p>
      <div role="tablist" className="mt-5 flex gap-1 border-b border-border">
        {(["open", "done", "all"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn("border-b-2 px-3 py-2 text-sm font-medium capitalize", filter === f ? "border-brand text-brand-text" : "border-transparent text-muted hover:text-text")}
          >
            {f === "done" ? "Completed" : f} <span className="text-xs text-subtle">{counts[f]}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        {error ? (
          <ErrorState message="Couldn't load action items." onRetry={() => mutate()} />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-5" />} title={filter === "open" ? "Nothing left to do" : "No action items"} description={filter === "open" ? "Every action item across your meetings is complete." : undefined} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <button onClick={() => toggle(item)} aria-label={item.is_completed ? `Mark “${item.text}” as not done` : `Mark “${item.text}” as done`} className="mt-0.5 text-muted hover:text-brand">
                  {item.is_completed ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[14px]", item.is_completed && "text-muted line-through")}>{item.text}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <Link href={`/meetings/${item.meeting_id}`} className="font-medium text-brand-text hover:underline">
                      {item.meeting_title}
                    </Link>
                    {item.due_date && <span>Due {formatShortDate(item.due_date)}</span>}
                  </p>
                </div>
                {item.assignee && (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Avatar name={item.assignee.name} size="xs" />
                    <span className="hidden sm:inline">{item.assignee.name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
