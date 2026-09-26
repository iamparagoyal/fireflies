"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { api } from "@/lib/api";
import { formatMeetingDate } from "@/lib/format";
import { keys } from "@/lib/queries";
import type { Comment } from "@/lib/types";

export function CommentThread({ meetingId, segmentId, comments, onClose }: { meetingId: number; segmentId: number; comments: Comment[]; onClose: () => void }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = () => Promise.all([mutate(keys.comments(meetingId)), mutate(keys.transcript(meetingId))]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.createComment(segmentId, body.trim());
      setBody("");
      await refresh();
      toast.success("Comment added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add comment");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteComment(id);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete comment");
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border bg-surface-muted p-3" onClick={(e) => e.stopPropagation()}>
      {comments.length > 0 && (
        <ul className="mb-3 space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-2">
              <Avatar name={c.author.name} color={c.author.avatar_color} size="xs" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-semibold">{c.author.name}</span>{" "}
                  <span className="text-subtle">{formatMeetingDate(c.created_at)}</span>
                </p>
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
              <button onClick={() => remove(c.id)} aria-label="Delete comment" className="self-start rounded p-1 text-subtle opacity-0 hover:text-danger group-hover:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <Textarea
          aria-label="Add a comment"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
          }}
          placeholder="Add a comment…"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" variant="primary" type="submit" loading={saving} disabled={!body.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
