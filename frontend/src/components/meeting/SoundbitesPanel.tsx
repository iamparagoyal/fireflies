"use client";

import { Scissors, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { keys } from "@/lib/queries";
import type { MeetingDetail } from "@/lib/types";

import { Timestamp } from "./Timestamp";

export function SoundbitesPanel({ meeting }: { meeting: MeetingDetail }) {
  const player = usePlayer();
  const [title, setTitle] = useState("");
  const [length, setLength] = useState(30);
  const [saving, setSaving] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const start = Math.floor(player.currentTime);
    try {
      await api.createSoundbite(meeting.id, {
        title: title.trim() || `Clip at ${formatClock(start)}`,
        start_seconds: start,
        end_seconds: Math.min(start + length, meeting.duration_seconds || start + length),
      });
      await mutate(keys.meeting(meeting.id));
      setTitle("");
      toast.success("Soundbite created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create soundbite");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteSoundbite(id);
      await mutate(keys.meeting(meeting.id));
      toast.success("Soundbite deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete soundbite");
    }
  };

  return (
    <div>
      <form onSubmit={create} className="mb-4 rounded-feature bg-surface-muted p-4">
        <p className="mb-2 text-[13px] text-muted">
          Clip a moment starting at the playhead (<span className="font-mono">{formatClock(player.currentTime)}</span>). You can also use the bookmark icon on any transcript line.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Soundbite title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Soundbite title" className="min-w-40 flex-1" />
          <select aria-label="Clip length" value={length} onChange={(e) => setLength(Number(e.target.value))} className="h-9 rounded-control border border-border bg-surface px-2 text-sm">
            {[15, 30, 60, 120].map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
          <Button type="submit" variant="primary" loading={saving}>
            <Scissors className="size-4" /> Clip
          </Button>
        </div>
      </form>
      {meeting.soundbites.length === 0 ? (
        <EmptyState title="No soundbites yet" description="Save memorable moments to revisit or share later." />
      ) : (
        <ul className="space-y-2">
          {meeting.soundbites.map((s) => (
            <li key={s.id} className="card group flex items-center gap-3 px-3 py-2">
              <Timestamp seconds={s.start_seconds} withIcon />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted">{formatClock(s.end_seconds - s.start_seconds)} long</p>
              </div>
              <button onClick={() => remove(s.id)} aria-label={`Delete soundbite ${s.title}`} className="rounded p-1 text-subtle opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
