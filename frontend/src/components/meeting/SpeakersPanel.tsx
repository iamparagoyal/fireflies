import { Avatar } from "@/components/ui/Avatar";
import { colorForName, formatDuration } from "@/lib/format";
import type { MeetingDetail } from "@/lib/types";

export function speakerStats(meeting: MeetingDetail) {
  const total = meeting.participants.reduce((sum, p) => sum + p.talk_time_seconds, 0);
  return meeting.participants
    .map((p) => ({ ...p, share: total ? Math.round((p.talk_time_seconds / total) * 100) : 0 }))
    .sort((a, b) => b.talk_time_seconds - a.talk_time_seconds);
}

export function SpeakersPanel({ meeting }: { meeting: MeetingDetail }) {
  const stats = speakerStats(meeting);
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Talk time</p>
      <ul className="space-y-3">
        {stats.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Avatar name={p.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {p.name}
                  {p.is_host && <span className="ml-1.5 text-[10px] font-semibold uppercase text-brand-text">Host</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {p.share}% · {formatDuration(p.talk_time_seconds)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full rounded-full" style={{ width: `${p.share}%`, backgroundColor: colorForName(p.name) }} />
              </div>
              {p.email && <p className="mt-0.5 truncate text-xs text-subtle">{p.email}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
