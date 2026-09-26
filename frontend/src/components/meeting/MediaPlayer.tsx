"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useMemo, useRef } from "react";

import { colorForName, formatClock } from "@/lib/format";
import { PLAYBACK_RATES, usePlayer } from "@/lib/player";
import type { Chapter, Segment } from "@/lib/types";

export function MediaPlayer({ segments, chapters, mediaUrl }: { segments: Segment[]; chapters: Chapter[]; mediaUrl: string | null }) {
  const { currentTime, duration: totalDuration, playing, rate, toggle, skip, seek, setRate, mediaRef } = usePlayer();
  const trackRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(totalDuration, 1);
  const progress = (currentTime / duration) * 100;

  const speakerBlocks = useMemo(
    () =>
      segments.map((s) => ({
        id: s.id,
        left: (s.start_seconds / duration) * 100,
        width: Math.max(((s.end_seconds - s.start_seconds) / duration) * 100, 0.3),
        color: colorForName(s.speaker_name ?? "Unknown"),
        speaker: s.speaker_name ?? "Unknown",
      })),
    [segments, duration],
  );

  const seekFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    seek(((clientX - rect.left) / rect.width) * duration);
  };

  return (
    <div className="no-print border-t border-border bg-surface px-4 py-2.5">
      {mediaUrl && <audio ref={mediaRef} src={mediaUrl} preload="metadata" />}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => skip(-15)} aria-label="Back 15 seconds" className="rounded-full p-1.5 text-muted hover:bg-surface-hover hover:text-text">
            <RotateCcw className="size-4" />
          </button>
          <button
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="flex size-9 items-center justify-center btn-primary rounded-full transition"
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </button>
          <button onClick={() => skip(15)} aria-label="Forward 15 seconds" className="rounded-full p-1.5 text-muted hover:bg-surface-hover hover:text-text">
            <RotateCw className="size-4" />
          </button>
        </div>

        <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted" data-testid="player-time">
          {formatClock(currentTime)} / {formatClock(totalDuration)}
        </span>

        <div className="relative flex-1 py-2">
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(totalDuration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={formatClock(currentTime)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              seekFromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) seekFromPointer(e.clientX);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") skip(5);
              if (e.key === "ArrowLeft") skip(-5);
            }}
            className="group relative h-5 cursor-pointer"
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-hover">
              {speakerBlocks.map((b) => (
                <span key={b.id} className="absolute inset-y-0 opacity-35" style={{ left: `${b.left}%`, width: `${b.width}%`, backgroundColor: b.color }} />
              ))}
              <span className="absolute inset-y-0 left-0 bg-brand" style={{ width: `${progress}%` }} />
            </div>
            {chapters.map((c) => (
              <span
                key={c.id}
                title={c.title}
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-border-strong"
                style={{ left: `${(c.start_seconds / duration) * 100}%` }}
              />
            ))}
            <span
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        <label className="shrink-0">
          <span className="sr-only">Playback speed</span>
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="h-7 rounded-control border border-border bg-surface px-1.5 text-xs font-medium outline-none"
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>
      </div>
      {!mediaUrl && <p className="mt-0.5 text-center text-[11px] text-subtle">Audio isn&apos;t stored for this meeting, so playback is simulated against the transcript timeline.</p>}
    </div>
  );
}
