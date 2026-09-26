"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api";
import { useTags } from "@/lib/queries";

export function TagPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const { data: tags = [], mutate } = useTags();
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);

  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id]);

  const create = async () => {
    const name = draft.trim();
    if (!name) return;
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!value.includes(existing.id)) onChange([...value, existing.id]);
      setDraft("");
      return;
    }
    setCreating(true);
    try {
      const tag = await api.createTag(name);
      await mutate([...tags, tag], { revalidate: false });
      onChange([...value, tag.id]);
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create tag");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => {
        const selected = value.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(tag.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
              selected ? "border-transparent text-white" : "border-border text-muted hover:border-border-strong",
            )}
            style={selected ? { backgroundColor: tag.color } : undefined}
          >
            {selected && <Check className="size-3" />}
            {tag.name}
          </button>
        );
      })}
      <span className="inline-flex items-center rounded-full border border-dashed border-border-strong pl-2.5">
        <input
          aria-label="New tag name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
          }}
          placeholder="New tag"
          className="w-20 bg-transparent text-xs outline-none placeholder:text-subtle"
        />
        <button type="button" onClick={() => void create()} disabled={creating || !draft.trim()} aria-label="Create tag" className="px-1.5 py-1 text-muted hover:text-text disabled:opacity-40">
          <Plus className="size-3.5" />
        </button>
      </span>
    </div>
  );
}
