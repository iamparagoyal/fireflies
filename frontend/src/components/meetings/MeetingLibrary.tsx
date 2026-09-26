"use client";

import { CalendarSearch, Upload } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useOpenNewMeeting } from "@/components/layout/NewMeetingContext";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { filtersFromParams, filtersToParams } from "@/lib/filterParams";
import { dateGroupLabel } from "@/lib/format";
import { useMeetings } from "@/lib/queries";
import type { MeetingFilters as Filters, MeetingListItem, MeetingSource } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";

import { EditMeetingModal } from "./EditMeetingModal";
import { MeetingFilters } from "./MeetingFilters";
import { MeetingRow } from "./MeetingRow";
import { useDeleteMeeting } from "./useDeleteMeeting";

export function groupMeetings(meetings: MeetingListItem[], grouped: boolean, now = new Date()) {
  if (!grouped) return [{ label: null as string | null, items: meetings }];
  const groups: { label: string | null; items: MeetingListItem[] }[] = [];
  for (const meeting of meetings) {
    const label = dateGroupLabel(meeting.started_at, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(meeting);
    else groups.push({ label, items: [meeting] });
  }
  return groups;
}

export function MeetingLibrary({ title, subtitle, sources }: { title: string; subtitle: string; sources?: MeetingSource[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openNewMeeting = useOpenNewMeeting();
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(new URLSearchParams(searchParams.toString())));
  const debouncedQ = useDebounced(filters.q ?? "");
  const query = useMemo(() => ({ ...filters, q: debouncedQ, sources }), [filters, debouncedQ, sources]);
  const { data, error, isLoading, mutate } = useMeetings(query);
  const [editing, setEditing] = useState<MeetingListItem | null>(null);
  const deletion = useDeleteMeeting();

  const updateFilters = (next: Filters) => {
    setFilters(next);
    const qs = filtersToParams(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const groups = groupMeetings(data?.items ?? [], (filters.sort ?? "recent") === "recent" || filters.sort === "oldest");
  const filtered = !!(filters.q || filters.participantIds?.length || filters.tagIds?.length || filters.dateFrom || filters.dateTo);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {subtitle}
            {data && <> · {data.total} {data.total === 1 ? "meeting" : "meetings"}</>}
          </p>
        </div>
        <Button variant="primary" onClick={() => openNewMeeting("upload")}>
          <Upload className="size-4" /> Upload
        </Button>
      </div>

      <MeetingFilters value={filters} onChange={updateFilters} />

      <div className="mt-4 overflow-hidden card">
        {error ? (
          <div className="p-4">
            <ErrorState message="Couldn't load meetings. Is the backend running?" onRetry={() => mutate()} />
          </div>
        ) : isLoading && !data ? (
          <ul aria-label="Loading meetings">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
                <Skeleton className="size-9" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </li>
            ))}
          </ul>
        ) : data && data.items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<CalendarSearch className="size-5" />} title="No meetings match your filters" description="Try a different name, tag or date range." action={<Button onClick={() => updateFilters({ sort: filters.sort })}>Clear filters</Button>} />
          ) : (
            <EmptyState title="No meetings yet" description="Upload a transcript file or paste one to get AI notes, action items and a searchable transcript." action={<Button variant="primary" onClick={() => openNewMeeting("upload")}>Upload your first meeting</Button>} />
          )
        ) : (
          groups.map((group) => (
            <section key={group.label ?? "all"} aria-label={group.label ?? "Meetings"}>
              {group.label && <h2 className="border-b border-border bg-surface-muted px-5 py-2 text-xs font-semibold uppercase tracking-wide text-subtle">{group.label}</h2>}
              <ul>
                {group.items.map((meeting) => (
                  <MeetingRow key={meeting.id} meeting={meeting} onEdit={() => setEditing(meeting)} onDelete={() => deletion.setTarget(meeting)} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {editing && <EditMeetingModal meeting={editing} open onOpenChange={(open) => !open && setEditing(null)} />}
      <ConfirmDialog
        open={!!deletion.target}
        onOpenChange={(open) => !open && deletion.setTarget(null)}
        title="Delete meeting?"
        description={`“${deletion.target?.title}” and its transcript, notes and action items will be permanently deleted.`}
        loading={deletion.deleting}
        onConfirm={deletion.confirm}
      />
    </div>
  );
}
