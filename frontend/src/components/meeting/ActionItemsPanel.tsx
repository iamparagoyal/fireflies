"use client";

import { CalendarDays, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import { keys, refreshMeetingLists } from "@/lib/queries";
import type { ActionItem, ActionItemInput, MeetingDetail, MeetingParticipant } from "@/lib/types";

import { Timestamp } from "./Timestamp";

function useActionItemMutations(meeting: MeetingDetail) {
  const replace = (items: ActionItem[]) =>
    mutate(keys.meeting(meeting.id), (current?: MeetingDetail) => (current ? { ...current, action_items: items } : current), { revalidate: false });

  const update = async (item: ActionItem, data: ActionItemInput, successMessage?: string) => {
    const optimistic = meeting.action_items.map((a) =>
      a.id === item.id
        ? {
            ...a,
            ...("text" in data && data.text !== undefined ? { text: data.text } : {}),
            ...("is_completed" in data && data.is_completed !== undefined ? { is_completed: data.is_completed } : {}),
            ...("due_date" in data ? { due_date: data.due_date ?? null } : {}),
            ...("assignee_id" in data ? { assignee: meeting.participants.find((p) => p.id === data.assignee_id) ?? null } : {}),
          }
        : a,
    );
    await replace(optimistic);
    try {
      const saved = await api.updateActionItem(item.id, data);
      await replace(optimistic.map((a) => (a.id === saved.id ? saved : a)));
      void refreshMeetingLists();
      if (successMessage) toast.success(successMessage);
    } catch (err) {
      await replace(meeting.action_items);
      toast.error(err instanceof Error ? err.message : "Could not update action item");
    }
  };

  const create = async (data: ActionItemInput & { text: string }) => {
    const created = await api.createActionItem(meeting.id, data);
    await replace([...meeting.action_items, created]);
    void refreshMeetingLists();
    toast.success("Action item added");
  };

  const remove = async (item: ActionItem) => {
    await replace(meeting.action_items.filter((a) => a.id !== item.id));
    try {
      await api.deleteActionItem(item.id);
      void refreshMeetingLists();
      toast.success("Action item deleted");
    } catch (err) {
      await replace(meeting.action_items);
      toast.error(err instanceof Error ? err.message : "Could not delete action item");
    }
  };

  return { update, create, remove };
}

function ActionItemRow({
  item,
  participants,
  onUpdate,
  onDelete,
}: {
  item: ActionItem;
  participants: MeetingParticipant[];
  onUpdate: (data: ActionItemInput, message?: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  const commit = () => {
    setEditing(false);
    const next = text.trim();
    if (next && next !== item.text) onUpdate({ text: next });
    else setText(item.text);
  };

  return (
    <li className="group rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={item.is_completed}
          onChange={(e) => onUpdate({ is_completed: e.target.checked }, e.target.checked ? "Marked as done" : undefined)}
          aria-label={`Mark “${item.text}” as ${item.is_completed ? "not done" : "done"}`}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--brand)]"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              aria-label="Edit action item"
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setText(item.text);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={cn("block w-full text-left text-[14px] leading-snug", item.is_completed && "text-muted line-through")}
              title="Click to edit"
            >
              {item.text}
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Assignee"
              value={item.assignee?.id ?? ""}
              onChange={(e) => onUpdate({ assignee_id: e.target.value ? Number(e.target.value) : null })}
              className="h-6 rounded-md border border-border bg-surface-muted px-1.5 text-xs outline-none"
            >
              <option value="">Unassigned</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1 text-muted">
              <CalendarDays className="size-3.5" />
              <span className="sr-only">Due date</span>
              <input
                type="date"
                value={item.due_date ?? ""}
                onChange={(e) => onUpdate({ due_date: e.target.value || null })}
                className="h-6 rounded-md border border-border bg-surface-muted px-1 text-xs outline-none"
              />
            </label>
            {item.due_date && !item.is_completed && <span className="text-muted">Due {formatShortDate(item.due_date)}</span>}
            {item.is_ai_generated && (
              <span className="inline-flex items-center gap-1 text-brand-text" title="Extracted by AI">
                <Sparkles className="size-3" /> AI
              </span>
            )}
            {item.timestamp_seconds !== null && <Timestamp seconds={item.timestamp_seconds} withIcon />}
            <button onClick={onDelete} aria-label="Delete action item" className="ml-auto rounded p-1 text-subtle opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ActionItemsPanel({ meeting }: { meeting: MeetingDetail }) {
  const { update, create, remove } = useActionItemMutations(meeting);
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);
  const open = meeting.action_items.filter((a) => !a.is_completed);
  const done = meeting.action_items.filter((a) => a.is_completed);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await create({ text: text.trim(), assignee_id: assignee ? Number(assignee) : null });
      setText("");
      setAssignee("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add action item");
    } finally {
      setSaving(false);
    }
  };

  const row = (item: ActionItem) => (
    <ActionItemRow
      key={item.id}
      item={item}
      participants={meeting.participants}
      onUpdate={(data, message) => void update(item, data, message)}
      onDelete={() => void remove(item)}
    />
  );

  return (
    <div>
      <form onSubmit={submit} className="mb-4 flex flex-wrap gap-2">
        <Input aria-label="New action item" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an action item…" className="min-w-48 flex-1" />
        <Select aria-label="New action item assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-36">
          <option value="">Unassigned</option>
          {meeting.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="primary" loading={saving} disabled={!text.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>

      {meeting.action_items.length === 0 ? (
        <EmptyState title="No action items" description="Add tasks that came out of this meeting and track them to completion." />
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
            To do · {open.length}
          </p>
          <ul className="space-y-2">{open.map(row)}</ul>
          {done.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-subtle">Completed · {done.length}</p>
              <ul className="space-y-2">{done.map(row)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
