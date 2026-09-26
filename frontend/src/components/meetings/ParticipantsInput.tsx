"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";
import { useParticipants } from "@/lib/queries";
import type { ParticipantInput } from "@/lib/types";

export function ParticipantsInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ParticipantInput[];
  onChange: (value: ParticipantInput[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const { data: known = [] } = useParticipants();
  const listId = useId();

  const add = (raw: string) => {
    const names = raw.split(",").map((n) => n.trim()).filter(Boolean);
    if (!names.length) return;
    const next = [...value];
    for (const name of names) {
      if (next.some((p) => p.name.toLowerCase() === name.toLowerCase())) continue;
      const match = known.find((p) => p.name.toLowerCase() === name.toLowerCase());
      next.push({ name: match?.name ?? name, email: match?.email ?? null, is_host: next.length === 0 });
    }
    onChange(next);
    setDraft("");
  };

  const remove = (name: string) => {
    const next = value.filter((p) => p.name !== name);
    if (next.length && !next.some((p) => p.is_host)) next[0] = { ...next[0], is_host: true };
    onChange(next);
  };

  return (
    <div className={cn(inputClass, "flex min-h-9 flex-wrap items-center gap-1.5 py-1.5")}>
      {value.map((p) => (
        <span key={p.name} className="inline-flex items-center gap-1.5 rounded-full bg-surface-hover py-0.5 pl-0.5 pr-2 text-[13px]">
          <Avatar name={p.name} size="xs" />
          {p.name}
          {p.is_host && <span className="text-[10px] font-semibold uppercase text-brand-text">Host</span>}
          <button type="button" onClick={() => remove(p.name)} aria-label={`Remove ${p.name}`} className="text-subtle hover:text-text">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        value={draft}
        onChange={(e) => {
          if (e.target.value.endsWith(",")) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            remove(value[value.length - 1].name);
          }
        }}
        onBlur={() => add(draft)}
        placeholder={value.length ? "Add another…" : "Type a name and press Enter"}
        className="min-w-32 flex-1 bg-transparent outline-none placeholder:text-subtle"
      />
      <datalist id={listId}>
        {known.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
    </div>
  );
}
