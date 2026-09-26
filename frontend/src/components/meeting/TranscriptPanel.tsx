"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { colorForName, formatClock } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { keys, useComments } from "@/lib/queries";
import { activeSegmentIndex, findMatches } from "@/lib/transcript";
import type { Comment, Segment } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";

import { TranscriptLine } from "./TranscriptLine";

const EMPTY: Comment[] = [];

export function TranscriptPanel({ meetingId, segments }: { meetingId: number; segments: Segment[] }) {
  const player = usePlayer();
  const { data: comments = EMPTY } = useComments(meetingId);
  const [rawQuery, setRawQuery] = useState("");
  const query = useDebounced(rawQuery, 150);
  const [matchCursor, setMatchCursor] = useState({ key: "", index: 0 });
  const [hiddenSpeakers, setHiddenSpeakers] = useState<Set<string>>(new Set());
  const [follow, setFollow] = useState(true);
  const [openThread, setOpenThread] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const speakers = useMemo(() => Array.from(new Set(segments.map((s) => s.speaker_name ?? "Unknown speaker"))), [segments]);
  const visible = useMemo(
    () => (hiddenSpeakers.size ? segments.filter((s) => !hiddenSpeakers.has(s.speaker_name ?? "Unknown speaker")) : segments),
    [segments, hiddenSpeakers],
  );
  const matches = useMemo(() => findMatches(visible, query), [visible, query]);
  const matchKey = `${query}|${[...hiddenSpeakers].join(",")}`;
  const matchIndex = matchCursor.key === matchKey ? matchCursor.index : 0;
  const currentMatch = matches.length ? matches[Math.min(matchIndex, matches.length - 1)] : null;

  const activeIndex = activeSegmentIndex(segments, player.currentTime);
  const activeId = activeIndex >= 0 ? segments[activeIndex].id : null;

  const commentsBySegment = useMemo(() => {
    const map = new Map<number, Comment[]>();
    for (const c of comments) map.set(c.segment_id, [...(map.get(c.segment_id) ?? []), c]);
    return map;
  }, [comments]);

  useEffect(() => {
    if (!currentMatch) return;
    document.getElementById(`segment-${currentMatch.segmentId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentMatch]);

  useEffect(() => {
    if (!follow || !player.playing || activeId === null || query) return;
    document.getElementById(`segment-${activeId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId, follow, player.playing, query]);

  const step = (delta: number) => {
    if (!matches.length) return;
    setMatchCursor({ key: matchKey, index: (matchIndex + delta + matches.length) % matches.length });
  };

  const { seek } = player;
  const onSeek = useCallback((segment: Segment) => seek(segment.start_seconds, { play: true }), [seek]);
  const onToggleComments = useCallback((id: number) => setOpenThread((current) => (current === id ? null : id)), []);
  const onCreateSoundbite = useCallback(
    async (segment: Segment) => {
      const words = segment.text.split(/\s+/).slice(0, 8).join(" ");
      try {
        await api.createSoundbite(meetingId, {
          title: `${segment.speaker_name ?? "Clip"}: ${words}${segment.text.split(/\s+/).length > 8 ? "…" : ""}`,
          start_seconds: segment.start_seconds,
          end_seconds: Math.max(segment.end_seconds, segment.start_seconds + 5),
        });
        await mutate(keys.meeting(meetingId));
        toast.success("Soundbite created", { description: `${formatClock(segment.start_seconds)} – ${formatClock(segment.end_seconds)}` });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create soundbite");
      }
    },
    [meetingId],
  );

  const toggleSpeaker = (name: string) =>
    setHiddenSpeakers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next.size === speakers.length ? new Set() : next;
    });

  if (!segments.length) {
    return <EmptyState title="No transcript" description="This meeting was created without a transcript. Add action items and notes manually, or create a new meeting from a transcript file." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2.5 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search transcript</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  step(e.shiftKey ? -1 : 1);
                } else if (e.key === "Escape") setRawQuery("");
              }}
              placeholder="Search transcript"
              className="h-8 w-full rounded-lg border border-border bg-surface-muted pl-8 pr-8 text-sm outline-none focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20"
            />
            {rawQuery && (
              <button onClick={() => setRawQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-text">
                <X className="size-3.5" />
              </button>
            )}
          </label>
          {query.trim() && (
            <div className="flex items-center gap-0.5 text-xs text-muted">
              <span className="min-w-14 text-center tabular-nums" aria-live="polite" data-testid="match-count">
                {matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1} of ${matches.length}` : "No results"}
              </span>
              <button onClick={() => step(-1)} disabled={!matches.length} aria-label="Previous match" className="rounded p-1 hover:bg-surface-hover disabled:opacity-40">
                <ChevronUp className="size-4" />
              </button>
              <button onClick={() => step(1)} disabled={!matches.length} aria-label="Next match" className="rounded p-1 hover:bg-surface-hover disabled:opacity-40">
                <ChevronDown className="size-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {speakers.map((name) => {
            const hidden = hiddenSpeakers.has(name);
            return (
              <button
                key={name}
                onClick={() => toggleSpeaker(name)}
                aria-pressed={!hidden}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition",
                  hidden ? "border-border text-subtle line-through" : "border-border-strong text-text",
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: colorForName(name) }} />
                {name}
              </button>
            );
          })}
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-[var(--brand)]" />
            Auto-scroll
          </label>
        </div>
      </div>
      <div ref={listRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <ol aria-label="Transcript">
          {visible.map((segment) => (
            <TranscriptLine
              key={segment.id}
              meetingId={meetingId}
              segment={segment}
              active={segment.id === activeId}
              query={query}
              activeOccurrence={currentMatch?.segmentId === segment.id ? currentMatch.occurrence : null}
              commentsOpen={openThread === segment.id}
              comments={commentsBySegment.get(segment.id) ?? EMPTY}
              onSeek={onSeek}
              onToggleComments={onToggleComments}
              onCreateSoundbite={onCreateSoundbite}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
