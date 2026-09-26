"use client";

import { CheckSquare, MessageCircleQuestion, Scissors, Sparkles, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { EditMeetingModal } from "@/components/meetings/EditMeetingModal";
import { useDeleteMeeting } from "@/components/meetings/useDeleteMeeting";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/components/ui/cn";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError } from "@/lib/api";
import { PlayerProvider, usePlayerController } from "@/lib/player";
import { useMeeting, useTranscript } from "@/lib/queries";
import type { MeetingDetail, Segment } from "@/lib/types";

import { ActionItemsPanel } from "./ActionItemsPanel";
import { AskPanel } from "./AskPanel";
import { MediaPlayer } from "./MediaPlayer";
import { MeetingHeader } from "./MeetingHeader";
import { NotesPanel } from "./NotesPanel";
import { SoundbitesPanel } from "./SoundbitesPanel";
import { SpeakersPanel } from "./SpeakersPanel";
import { TranscriptPanel } from "./TranscriptPanel";

const TABS = [
  { id: "notes", label: "Summary", icon: Sparkles },
  { id: "actions", label: "Action items", icon: CheckSquare },
  { id: "ask", label: "Ask AI", icon: MessageCircleQuestion },
  { id: "speakers", label: "Speakers", icon: Users },
  { id: "soundbites", label: "Soundbites", icon: Scissors },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function MeetingDetailView({ meetingId }: { meetingId: number }) {
  const { data: meeting, error } = useMeeting(meetingId);
  const { data: segments, error: transcriptError } = useTranscript(meetingId);

  if (error || transcriptError) {
    const notFound = (error ?? transcriptError) instanceof ApiError && (error ?? transcriptError).status === 404;
    return notFound ? (
      <EmptyState title="Meeting not found" description="It may have been deleted." />
    ) : (
      <div className="p-6">
        <ErrorState message="Couldn't load this meeting. Is the backend running?" />
      </div>
    );
  }

  if (!meeting || !segments) {
    return (
      <div className="space-y-4 p-6" aria-label="Loading meeting">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return <LoadedMeeting meeting={meeting} segments={segments} />;
}

function LoadedMeeting({ meeting, segments }: { meeting: MeetingDetail; segments: Segment[] }) {
  const router = useRouter();
  const duration = Math.max(meeting.duration_seconds, segments.at(-1)?.end_seconds ?? 0);
  const player = usePlayerController(duration, !!meeting.media_url);
  const [tab, setTab] = useState<TabId>("notes");
  const [editing, setEditing] = useState(false);
  const deletion = useDeleteMeeting(() => router.push("/meetings"));
  const openActions = meeting.action_items.filter((a) => !a.is_completed).length;
  const startAt = Number(useSearchParams().get("t"));
  const { seek } = player;

  useEffect(() => {
    if (!startAt) return;
    seek(startAt);
    const target = segments.findLast((s) => s.start_seconds <= startAt);
    if (!target) return;
    requestAnimationFrame(() => {
      document.getElementById(`segment-${target.id}`)?.scrollIntoView({ block: "center" });
    });
  }, [startAt, seek, segments]);

  return (
    <PlayerProvider value={player}>
      <div className="flex h-full min-h-0 flex-col">
        <MeetingHeader meeting={meeting} onEdit={() => setEditing(true)} onDelete={() => deletion.setTarget(meeting)} />
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
          <section className="flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r" aria-label="Meeting notes">
            <div role="tablist" aria-label="Meeting sections" className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2.5 text-[13px] font-medium transition",
                    tab === id ? "border-brand text-brand-text" : "border-transparent text-muted hover:text-text",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                  {id === "actions" && openActions > 0 && <span className="rounded-full bg-brand-soft px-1.5 text-[11px] font-semibold text-brand-text">{openActions}</span>}
                </button>
              ))}
            </div>
            <div role="tabpanel" className={cn("min-h-0 flex-1 px-5 py-4", tab === "ask" ? "flex flex-col" : "scrollbar-thin overflow-y-auto")}>
              {tab === "notes" && <NotesPanel meeting={meeting} />}
              {tab === "actions" && <ActionItemsPanel meeting={meeting} />}
              {tab === "ask" && <AskPanel meeting={meeting} />}
              {tab === "speakers" && <SpeakersPanel meeting={meeting} />}
              {tab === "soundbites" && <SoundbitesPanel meeting={meeting} />}
            </div>
          </section>
          <section className="flex min-h-0 flex-col bg-surface" aria-label="Transcript">
            <TranscriptPanel meetingId={meeting.id} segments={segments} />
          </section>
        </div>
        <MediaPlayer segments={segments} chapters={meeting.chapters} mediaUrl={meeting.media_url} />
      </div>
      <EditMeetingModal meeting={meeting} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={!!deletion.target}
        onOpenChange={(open) => !open && deletion.setTarget(null)}
        title="Delete meeting?"
        description={`“${meeting.title}” and its transcript, notes and action items will be permanently deleted.`}
        loading={deletion.deleting}
        onConfirm={deletion.confirm}
      />
    </PlayerProvider>
  );
}
