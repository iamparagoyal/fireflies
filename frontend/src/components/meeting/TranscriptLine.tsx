"use client";

import { Bookmark, MessageSquare } from "lucide-react";
import { memo } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/components/ui/cn";
import { splitHighlights } from "@/lib/transcript";
import type { Comment, Segment } from "@/lib/types";

import { CommentThread } from "./CommentThread";
import { Timestamp } from "./Timestamp";

interface Props {
  meetingId: number;
  segment: Segment;
  active: boolean;
  query: string;
  activeOccurrence: number | null;
  commentsOpen: boolean;
  comments: Comment[];
  onSeek: (segment: Segment) => void;
  onToggleComments: (segmentId: number) => void;
  onCreateSoundbite: (segment: Segment) => void;
}

export const TranscriptLine = memo(function TranscriptLine({
  meetingId,
  segment,
  active,
  query,
  activeOccurrence,
  commentsOpen,
  comments,
  onSeek,
  onToggleComments,
  onCreateSoundbite,
}: Props) {
  let occurrence = -1;
  const speaker = segment.speaker_name ?? "Unknown speaker";

  return (
    <li
      id={`segment-${segment.id}`}
      data-active={active || undefined}
      className={cn(
        "group relative flex gap-3 rounded-lg px-3 py-2.5 transition-colors",
        active ? "bg-active-line" : "hover:bg-surface-muted",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded bg-brand" aria-hidden />}
      <Avatar name={speaker} size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">{speaker}</span>
          <Timestamp seconds={segment.start_seconds} />
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <button
              onClick={() => onToggleComments(segment.id)}
              aria-label="Comment on this line"
              className="rounded p-1 text-subtle hover:bg-surface-hover hover:text-text"
            >
              <MessageSquare className="size-3.5" />
            </button>
            <button
              onClick={() => onCreateSoundbite(segment)}
              aria-label="Create soundbite from this line"
              className="rounded p-1 text-subtle hover:bg-surface-hover hover:text-text"
            >
              <Bookmark className="size-3.5" />
            </button>
          </div>
          {segment.comment_count > 0 && (
            <button
              onClick={() => onToggleComments(segment.id)}
              className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand-text"
              aria-label={`${segment.comment_count} comments`}
            >
              <MessageSquare className="size-3" /> {segment.comment_count}
            </button>
          )}
        </div>
        <p
          onClick={() => onSeek(segment)}
          className="mt-0.5 cursor-pointer text-[14px] leading-relaxed text-text/90"
          data-testid="segment-text"
        >
          {splitHighlights(segment.text, query).map((part, i) => {
            if (!part.match) return <span key={i}>{part.text}</span>;
            occurrence += 1;
            const isActive = activeOccurrence === occurrence;
            return (
              <mark key={i} data-active={isActive || undefined} data-match-active={isActive ? "true" : undefined}>
                {part.text}
              </mark>
            );
          })}
        </p>
        {commentsOpen && <CommentThread meetingId={meetingId} segmentId={segment.id} comments={comments} onClose={() => onToggleComments(segment.id)} />}
      </div>
    </li>
  );
});
