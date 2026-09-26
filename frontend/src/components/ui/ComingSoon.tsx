import { Rocket } from "lucide-react";

export function ComingSoon({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-border-strong bg-surface p-10 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-text">
          <Rocket className="size-5" />
        </div>
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-text">Coming soon</span>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">{description}</p>
        {children}
      </div>
    </div>
  );
}
