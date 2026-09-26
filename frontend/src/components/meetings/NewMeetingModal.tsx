"use client";

import { ClipboardPaste, FileUp, PenLine, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { NewMeetingTab } from "@/components/layout/NewMeetingContext";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api";
import { localInputToIso } from "@/lib/format";
import { refreshMeetingLists } from "@/lib/queries";
import type { ParticipantInput, Platform } from "@/lib/types";

import { ParticipantsInput } from "./ParticipantsInput";
import { TagPicker } from "./TagPicker";

const TABS: { id: NewMeetingTab; label: string; icon: typeof FileUp }[] = [
  { id: "upload", label: "Upload file", icon: FileUp },
  { id: "paste", label: "Paste transcript", icon: ClipboardPaste },
  { id: "form", label: "Manual entry", icon: PenLine },
];

const ACCEPTED = ".txt,.vtt,.srt,.json";
const SAMPLE = `[00:00:02] Jordan Blake: Thanks for hopping on. Let's review the onboarding checklist.
[00:00:09] Mei Chen: Sure. The SSO setup is done, but the data import is still pending.
[00:00:17] Jordan Blake: Okay, I'll send the CSV template to your team by Friday.
[00:00:24] Mei Chen: Perfect. Can you also schedule a training session for next week?
[00:00:31] Jordan Blake: Yes, I will schedule the training and share the invite tomorrow.`;

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function NewMeetingModal({
  tab,
  onClose,
  onTabChange,
}: {
  tab: NewMeetingTab | null;
  onClose: () => void;
  onTabChange: (tab: NewMeetingTab) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState(nowLocal);
  const [platform, setPlatform] = useState<Platform>("upload");
  const [participants, setParticipants] = useState<ParticipantInput[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [transcript, setTranscript] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setStartedAt(nowLocal());
    setPlatform("upload");
    setParticipants([]);
    setTagIds([]);
    setTranscript("");
    setDurationMinutes("30");
    setFile(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    const ext = picked.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["txt", "vtt", "srt", "json"].includes(ext)) {
      setError("Upload a .txt, .vtt, .srt or .json transcript");
      return;
    }
    setError(null);
    setFile(picked);
    if (!title) setTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const validate = (): string | null => {
    if (tab === "upload" && !file) return "Choose a transcript file to upload";
    if (tab !== "upload" && !title.trim()) return "Give the meeting a title";
    if (tab === "paste" && !transcript.trim()) return "Paste a transcript";
    if (tab === "form" && !participants.length) return "Add at least one participant";
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let meeting;
      if (tab === "upload" && file) {
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        form.append("started_at", localInputToIso(startedAt));
        form.append("platform", platform);
        if (participants.length) form.append("participants", participants.map((p) => p.name).join(","));
        if (tagIds.length) form.append("tag_ids", tagIds.join(","));
        meeting = await api.uploadMeeting(form);
      } else {
        meeting = await api.createMeeting({
          title: title.trim(),
          started_at: localInputToIso(startedAt),
          platform,
          participants,
          tag_ids: tagIds,
          transcript: tab === "paste" ? transcript : null,
          duration_seconds: tab === "form" ? Math.max(0, Number(durationMinutes) || 0) * 60 : null,
        });
      }
      await refreshMeetingLists();
      toast.success("Meeting created", {
        description: meeting.segment_count ? `${meeting.segment_count} transcript lines processed and summarized.` : undefined,
      });
      close();
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={tab !== null}
      onOpenChange={(open) => !open && close()}
      title="Add a meeting"
      description="Upload or paste a transcript and we'll generate notes, action items and an outline."
      size="lg"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-meeting-form" loading={submitting}>
            {tab === "form" ? "Create meeting" : "Transcribe & summarize"}
          </Button>
        </>
      }
    >
      <div role="tablist" aria-label="How to add the meeting" className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-surface-hover p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => {
              setError(null);
              onTabChange(id);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md py-1.5 text-[13px] font-medium transition",
              tab === id ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <form id="new-meeting-form" onSubmit={submit} className="space-y-4" noValidate>
        {tab === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
              dragging ? "border-brand bg-brand-soft" : "border-border-strong hover:border-brand hover:bg-surface-hover",
            )}
          >
            <UploadCloud className="mb-2 size-8 text-brand" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium">Drag & drop a transcript, or click to browse</p>
                <p className="mt-1 text-xs text-muted">Supports .txt, .vtt, .srt and .json · up to 5 MB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              aria-label="Transcript file"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="meeting-title">
            <Input id="meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tab === "upload" ? "Defaults to the file name" : "e.g. Weekly product sync"} />
          </Field>
          <Field label="Date & time" htmlFor="meeting-date">
            <Input id="meeting-date" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </Field>
          <Field label="Platform" htmlFor="meeting-platform">
            <Select id="meeting-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              <option value="upload">Uploaded file</option>
              <option value="zoom">Zoom</option>
              <option value="google_meet">Google Meet</option>
              <option value="teams">Microsoft Teams</option>
            </Select>
          </Field>
          {tab === "form" && (
            <Field label="Duration (minutes)" htmlFor="meeting-duration">
              <Input id="meeting-duration" type="number" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            </Field>
          )}
        </div>

        <Field label="Participants" htmlFor="meeting-participants" hint={tab === "form" ? undefined : "Speakers found in the transcript are added automatically."}>
          <ParticipantsInput id="meeting-participants" value={participants} onChange={setParticipants} />
        </Field>

        <div className="space-y-1.5">
          <span className="block text-[13px] font-medium">Tags</span>
          <TagPicker value={tagIds} onChange={setTagIds} />
        </div>

        {tab === "paste" && (
          <Field label="Transcript" htmlFor="meeting-transcript" hint="One line per utterance, e.g. “[00:01:23] Jane Doe: text”. WebVTT, SRT and JSON also work.">
            <Textarea id="meeting-transcript" rows={9} value={transcript} onChange={(e) => setTranscript(e.target.value)} className="font-mono text-[13px]" placeholder={SAMPLE} />
            {!transcript && (
              <button type="button" onClick={() => setTranscript(SAMPLE)} className="text-xs font-medium text-brand-text hover:underline">
                Use a sample transcript
              </button>
            )}
          </Field>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
