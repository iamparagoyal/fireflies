"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, Calendar, Clock, Download, FileText, MoreHorizontal, Pencil, Printer, RefreshCw, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

import { AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TagChip } from "@/components/ui/TagChip";
import { api } from "@/lib/api";
import { formatDuration, formatMeetingDate, platformLabel } from "@/lib/format";
import { keys, refreshMeetingLists } from "@/lib/queries";
import type { MeetingDetail } from "@/lib/types";
import { menuContentClass, menuItemClass, menuDangerItemClass, menuSeparatorClass } from "@/components/ui/menu";


export function MeetingHeader({ meeting, onEdit, onDelete }: { meeting: MeetingDetail; onEdit: () => void; onDelete: () => void }) {
  const [regenerating, setRegenerating] = useState(false);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const updated = await api.regenerateNotes(meeting.id);
      await mutate(keys.meeting(meeting.id), updated, { revalidate: false });
      void refreshMeetingLists();
      toast.success("AI notes regenerated", { description: "Your manually added action items were kept." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate notes");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <header className="no-print border-b border-border bg-surface px-4 py-3 sm:px-6">
      <Link href="/meetings" className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> All meetings
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{meeting.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" /> {formatMeetingDate(meeting.started_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {formatDuration(meeting.duration_seconds)}
            </span>
            <span>{platformLabel(meeting.platform)}</span>
            <AvatarStack names={meeting.participants.map((p) => p.name)} max={5} size="xs" />
            {meeting.tags.map((t) => (
              <TagChip key={t.id} name={t.name} color={t.color} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => toast.info("Sharing is coming soon", { description: "Team sharing and collaboration aren't part of this demo." })}>
            <Share2 className="size-4" /> Share
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm">
                <Download className="size-4" /> Export
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className={menuContentClass}>
                <DropdownMenu.Item asChild className={menuItemClass}>
                  <a href={api.exportUrl(meeting.id, "md")} download>
                    <FileText className="size-4" /> Markdown (.md)
                  </a>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild className={menuItemClass}>
                  <a href={api.exportUrl(meeting.id, "txt")} download>
                    <FileText className="size-4" /> Plain text (.txt)
                  </a>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild className={menuItemClass}>
                  <Link href={`/meetings/${meeting.id}/print`} target="_blank">
                    <Printer className="size-4" /> PDF (print)
                  </Link>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm" aria-label="More actions" className="!px-2">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className={menuContentClass}>
                <DropdownMenu.Item className={menuItemClass} onSelect={onEdit}>
                  <Pencil className="size-4" /> Edit details
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItemClass} disabled={!meeting.segment_count || regenerating} onSelect={() => void regenerate()}>
                  <RefreshCw className={regenerating ? "size-4 animate-spin" : "size-4"} /> Regenerate AI notes
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={menuSeparatorClass} />
                <DropdownMenu.Item className={menuDangerItemClass} onSelect={onDelete}>
                  <Trash2 className="size-4" /> Delete meeting
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}
