"use client";

import { Play } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { formatClock } from "@/lib/format";
import { usePlayerControls } from "@/lib/player";

export function Timestamp({ seconds, className, withIcon = false }: { seconds: number; className?: string; withIcon?: boolean }) {
  const player = usePlayerControls();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        player.seek(seconds, { play: true });
      }}
      className={cn("inline-flex items-center gap-1 rounded px-1 font-mono text-xs tabular-nums text-brand-text hover:bg-brand-soft", className)}
      aria-label={`Play from ${formatClock(seconds)}`}
    >
      {withIcon && <Play className="size-3 fill-current" />}
      {formatClock(seconds)}
    </button>
  );
}
