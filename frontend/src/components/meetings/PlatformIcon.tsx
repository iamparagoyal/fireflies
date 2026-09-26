import { FileText, Video } from "lucide-react";

import { cn } from "@/components/ui/cn";
import { platformLabel } from "@/lib/format";

const styles: Record<string, string> = {
  zoom: "bg-[#2d8cff]/12 text-[#2d8cff]",
  google_meet: "bg-[#00897b]/12 text-[#00897b]",
  teams: "bg-[#5b5fc7]/12 text-[#5b5fc7]",
  upload: "bg-brand-soft text-brand-text",
};

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const Icon = platform === "upload" ? FileText : Video;
  return (
    <span title={platformLabel(platform)} className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-control", styles[platform] ?? styles.upload, className)}>
      <Icon className="size-[18px]" />
    </span>
  );
}
