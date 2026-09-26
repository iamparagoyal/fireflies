"use client";

import { useEffect } from "react";

import { Spinner } from "@/components/ui/States";
import { formatClock, formatDuration, formatMeetingDate } from "@/lib/format";
import { useMeeting, useTranscript } from "@/lib/queries";

export function PrintableMeeting({ meetingId }: { meetingId: number }) {
  const { data: meeting } = useMeeting(meetingId);
  const { data: segments } = useTranscript(meetingId);
  const ready = !!meeting && !!segments;

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [ready]);

  if (!meeting || !segments) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl bg-surface px-8 py-10 text-[14px] leading-relaxed">
      <h1 className="text-2xl font-bold">{meeting.title}</h1>
      <p className="mt-1 text-muted">
        {formatMeetingDate(meeting.started_at)} · {formatDuration(meeting.duration_seconds)} · {meeting.participants.map((p) => p.name).join(", ")}
      </p>
      {meeting.summary && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Overview</h2>
          <p>{meeting.summary.overview}</p>
          {meeting.summary.bullet_points.length > 0 && (
            <>
              <h2 className="mt-6 text-lg font-semibold">Notes</h2>
              <ul className="list-disc pl-5">
                {meeting.summary.bullet_points.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {meeting.action_items.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-semibold">Action items</h2>
          <ul className="pl-1">
            {meeting.action_items.map((a) => (
              <li key={a.id}>
                {a.is_completed ? "☑" : "☐"} {a.text}
                {a.assignee && <strong> — {a.assignee.name}</strong>}
              </li>
            ))}
          </ul>
        </>
      )}
      {meeting.chapters.length > 0 && (
        <>
          <h2 className="mt-6 text-lg font-semibold">Outline</h2>
          <ol className="pl-1">
            {meeting.chapters.map((c) => (
              <li key={c.id}>
                <span className="font-mono text-xs">{formatClock(c.start_seconds)}</span> <strong>{c.title}</strong> — {c.summary}
              </li>
            ))}
          </ol>
        </>
      )}
      <h2 className="mt-6 text-lg font-semibold">Transcript</h2>
      {segments.map((s) => (
        <p key={s.id} className="mt-2 break-inside-avoid">
          <strong>{s.speaker_name ?? "Unknown"}</strong> <span className="font-mono text-xs text-muted">{formatClock(s.start_seconds)}</span>
          <br />
          {s.text}
        </p>
      ))}
    </article>
  );
}
