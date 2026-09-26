"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CheckSquare, Clock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { AvatarStack } from "@/components/ui/Avatar";
import { TagChip } from "@/components/ui/TagChip";
import { formatDuration, formatMeetingDate } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";

import { PlatformIcon } from "./PlatformIcon";
import { menuContentClass, menuItemClass, menuDangerItemClass } from "@/components/ui/menu";


export function MeetingRow({ meeting, onEdit, onDelete }: { meeting: MeetingListItem; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <li className="group relative flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-surface-muted">
      <PlatformIcon platform={meeting.platform} />
      <div className="min-w-0 flex-1">
        <Link href={`/meetings/${meeting.id}`} className="block truncate text-[15px] font-semibold text-text after:absolute after:inset-0 hover:text-brand-text">
          {meeting.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{formatMeetingDate(meeting.started_at)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {formatDuration(meeting.duration_seconds)}
          </span>
          {meeting.open_action_item_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="size-3.5" /> {meeting.open_action_item_count} open
            </span>
          )}
          {meeting.tags.map((tag) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      </div>
      <div className="hidden sm:block">
        <AvatarStack names={meeting.participants.map((p) => p.name)} />
      </div>
      {onEdit && onDelete && (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="relative z-10 rounded-control p-1.5 text-muted opacity-100 hover:bg-surface-hover hover:text-text sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100" aria-label={`Actions for ${meeting.title}`}>
          <MoreHorizontal className="size-4" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4} className={menuContentClass}>
            <DropdownMenu.Item className={menuItemClass} onSelect={onEdit}>
              <Pencil className="size-4" /> Edit details
            </DropdownMenu.Item>
            <DropdownMenu.Item className={menuDangerItemClass} onSelect={onDelete}>
              <Trash2 className="size-4" /> Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      )}
    </li>
  );
}
