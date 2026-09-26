"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { formatClock, formatMeetingDate } from "@/lib/format";
import { useSearch } from "@/lib/queries";
import { splitSnippet } from "@/lib/transcript";
import { useDebounced } from "@/lib/useDebounced";

import { MeetingRow } from "./MeetingRow";

export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [syncedInitial, setSyncedInitial] = useState(initial);
  const debounced = useDebounced(query, 300);
  const { data, error, isLoading } = useSearch(debounced);

  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    if (initial !== query.trim()) setQuery(initial);
  }

  useEffect(() => {
    const q = debounced.trim();
    if (q !== (params.get("q") ?? "")) router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false });
  }, [debounced, params, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Search</h1>
      <p className="mt-0.5 text-sm text-muted">Find any moment across every meeting transcript</p>
      <label className="relative mt-4 block">
        <span className="sr-only">Search query</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “pricing”, “SOC 2” or a person’s name" className="h-11 pl-10 text-base" autoFocus />
      </label>

      <div className="mt-6">
        {!debounced.trim() ? (
          <EmptyState icon={<Search className="size-5" />} title="Search your meetings" description="Matches in titles, participants and transcripts will show up here." />
        ) : error ? (
          <ErrorState message="Search failed. Is the backend running?" />
        ) : isLoading && !data ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : data && !data.meetings.length && !data.hits.length ? (
          <EmptyState title={`No results for “${debounced}”`} description="Check the spelling or try a broader term." />
        ) : data ? (
          <div className="space-y-8">
            {data.meetings.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Meetings · {data.meetings.length}</h2>
                <ul className="overflow-hidden card">
                  {data.meetings.map((m) => (
                    <MeetingRow key={m.id} meeting={m} />
                  ))}
                </ul>
              </section>
            )}
            {data.hits.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Transcript mentions · {data.hits.length}</h2>
                <ul className="space-y-2">
                  {data.hits.map((hit) => (
                    <li key={hit.segment_id}>
                      <Link href={`/meetings/${hit.meeting_id}?t=${Math.floor(hit.start_seconds)}`} className="card card-hover block px-4 py-3 hover:border-brand">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="font-semibold text-text">{hit.meeting_title}</span>
                          <span>{formatMeetingDate(hit.meeting_started_at)}</span>
                          <span className="font-mono text-brand-text">{formatClock(hit.start_seconds)}</span>
                        </div>
                        <p className="mt-1.5 flex gap-2 text-[14px]">
                          {hit.speaker_name && <Avatar name={hit.speaker_name} size="xs" className="mt-0.5" />}
                          <span>
                            {hit.speaker_name && <strong className="font-semibold">{hit.speaker_name}: </strong>}
                            {splitSnippet(hit.snippet).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
                          </span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
