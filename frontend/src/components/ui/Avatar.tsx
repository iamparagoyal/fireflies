import { colorForName, initials } from "@/lib/format";

import { cn } from "./cn";

const sizes = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };

export function Avatar({
  name,
  color,
  size = "sm",
  className,
}: {
  name: string;
  color?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", sizes[size], className)}
      style={{ backgroundColor: color ?? colorForName(name) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4, size = "sm" }: { names: string[]; max?: number; size?: keyof typeof sizes }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="flex items-center -space-x-1" aria-label={names.join(", ")}>
      {shown.map((name) => (
        <Avatar key={name} name={name} size={size} className="ring-2 ring-surface" />
      ))}
      {extra > 0 && (
        <span className={cn("inline-flex items-center justify-center rounded-full bg-surface-hover font-semibold text-muted ring-2 ring-surface", sizes[size])}>
          +{extra}
        </span>
      )}
    </span>
  );
}
