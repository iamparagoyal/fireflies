"use client";

import { Search, X } from "lucide-react";

import { Input, Select } from "@/components/ui/Field";
import { useParticipants, useTags } from "@/lib/queries";
import type { MeetingFilters as Filters, SortOrder } from "@/lib/types";

export function MeetingFilters({ value, onChange }: { value: Filters; onChange: (next: Filters) => void }) {
  const { data: participants = [] } = useParticipants();
  const { data: tags = [] } = useTags();
  const hasFilters = !!(value.q || value.participantIds?.length || value.tagIds?.length || value.dateFrom || value.dateTo);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-56 flex-1">
        <span className="sr-only">Filter by title or participant</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={value.q ?? ""}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Filter by title or participant"
          className="pl-9"
        />
      </label>
      <Select
        aria-label="Participant"
        className="w-auto"
        value={value.participantIds?.[0] ?? ""}
        onChange={(e) => onChange({ ...value, participantIds: e.target.value ? [Number(e.target.value)] : [] })}
      >
        <option value="">All participants</option>
        {participants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Tag"
        className="w-auto"
        value={value.tagIds?.[0] ?? ""}
        onChange={(e) => onChange({ ...value, tagIds: e.target.value ? [Number(e.target.value)] : [] })}
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Input aria-label="From date" type="date" className="w-auto" value={value.dateFrom ?? ""} max={value.dateTo} onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })} />
      <Input aria-label="To date" type="date" className="w-auto" value={value.dateTo ?? ""} min={value.dateFrom} onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })} />
      <Select aria-label="Sort" className="w-auto" value={value.sort ?? "recent"} onChange={(e) => onChange({ ...value, sort: e.target.value as SortOrder })}>
        <option value="recent">Most recent</option>
        <option value="oldest">Oldest first</option>
        <option value="longest">Longest</option>
        <option value="shortest">Shortest</option>
        <option value="title">Title A–Z</option>
      </Select>
      {hasFilters && (
        <button onClick={() => onChange({ sort: value.sort })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-text">
          <X className="size-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
