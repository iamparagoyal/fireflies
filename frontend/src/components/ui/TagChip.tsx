import { cn } from "./cn";

export function TagChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-xs font-medium", className)}
      style={{ color, backgroundColor: `${color}1a` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
