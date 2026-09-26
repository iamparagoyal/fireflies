export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff4fa3" />
            <stop offset="0.5" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#logo-gradient)" />
        <path d="M9 9h14v4H13v3h8v4h-8v3H9z" fill="white" />
      </svg>
      {!compact && <span className="text-[17px] font-bold tracking-tight">fireflies</span>}
    </span>
  );
}
