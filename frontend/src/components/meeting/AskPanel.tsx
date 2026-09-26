"use client";

import { Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api";
import { useMe } from "@/lib/queries";
import type { Citation, MeetingDetail } from "@/lib/types";

import { Timestamp } from "./Timestamp";

interface Message {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  error?: boolean;
}

const SUGGESTIONS = ["Summarize this meeting", "What are the action items?", "What was decided about the timeline?", "What concerns were raised?"];

export function AskPanel({ meeting }: { meeting: MeetingDetail }) {
  const { data: me } = useMe();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setPending(true);
    try {
      const response = await api.ask(meeting.id, q);
      setMessages((m) => [...m, { role: "assistant", text: response.answer, citations: response.citations }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: err instanceof Error ? err.message : "Something went wrong", error: true }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-border bg-gradient-to-br from-brand-soft to-surface p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-brand" /> Ask anything about this meeting
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {me?.llm_enabled ? `Answers come from ${me.llm_model} using the transcript.` : "Answers are drawn from the most relevant transcript moments."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:border-brand hover:text-brand-text">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
            {m.role === "user" ? (
              <Avatar name={me?.user.name ?? "You"} color={me?.user.avatar_color} size="sm" />
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                <Sparkles className="size-3.5" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-[14px] leading-relaxed",
                m.role === "user" ? "bg-brand text-white" : m.error ? "bg-danger-soft text-danger" : "bg-surface-hover",
              )}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {!!m.citations?.length && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
                  {m.citations.map((c) => (
                    <Timestamp key={c.segment_id} seconds={c.start_seconds} withIcon className="bg-surface" />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted" role="status">
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-brand" />
            </span>
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        className="flex items-center gap-2 rounded-xl border border-border bg-surface p-1.5 focus-within:border-brand"
      >
        <input
          aria-label="Ask a question about this meeting"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-subtle"
          disabled={!meeting.segment_count}
        />
        <button type="submit" disabled={!draft.trim() || pending} aria-label="Send question" className="rounded-lg bg-brand p-2 text-white disabled:opacity-40">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
