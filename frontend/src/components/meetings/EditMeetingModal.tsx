"use client";

import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { localInputToIso, toDateInputValue } from "@/lib/format";
import { keys, refreshMeetingLists } from "@/lib/queries";
import type { ParticipantInput, Platform, Tag } from "@/lib/types";

import { ParticipantsInput } from "./ParticipantsInput";
import { TagPicker } from "./TagPicker";

export interface EditableMeeting {
  id: number;
  title: string;
  started_at: string;
  platform: Platform;
  participants: { name: string; email: string | null; is_host?: boolean }[];
  tags: Tag[];
}

export function EditMeetingModal({ meeting, open, onOpenChange }: { meeting: EditableMeeting; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit meeting" size="md" footer={
      <>
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="primary" type="submit" form={`edit-meeting-${meeting.id}`}>Save changes</Button>
      </>
    }>
      {open && <EditMeetingForm meeting={meeting} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function EditMeetingForm({ meeting, onDone }: { meeting: EditableMeeting; onDone: () => void }) {
  const [title, setTitle] = useState(meeting.title);
  const [startedAt, setStartedAt] = useState(toDateInputValue(meeting.started_at));
  const [platform, setPlatform] = useState<Platform>(meeting.platform);
  const [participants, setParticipants] = useState<ParticipantInput[]>(
    meeting.participants.map((p, i) => ({ name: p.name, email: p.email, is_host: p.is_host ?? i === 0 })),
  );
  const [tagIds, setTagIds] = useState(meeting.tags.map((t) => t.id));
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Title can't be empty");
      return;
    }
    try {
      const updated = await api.updateMeeting(meeting.id, {
        title: title.trim(),
        started_at: localInputToIso(startedAt),
        platform,
        participants,
        tag_ids: tagIds,
      });
      await mutate(keys.meeting(meeting.id), updated, { revalidate: false });
      await Promise.all([refreshMeetingLists(), mutate(keys.transcript(meeting.id))]);
      toast.success("Meeting updated");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    }
  };

  return (
    <form id={`edit-meeting-${meeting.id}`} onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Title" htmlFor="edit-title">
        <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date & time" htmlFor="edit-date">
          <Input id="edit-date" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </Field>
        <Field label="Platform" htmlFor="edit-platform">
          <Select id="edit-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            <option value="upload">Uploaded file</option>
            <option value="zoom">Zoom</option>
            <option value="google_meet">Google Meet</option>
            <option value="teams">Microsoft Teams</option>
          </Select>
        </Field>
      </div>
      <Field label="Participants" htmlFor="edit-participants">
        <ParticipantsInput id="edit-participants" value={participants} onChange={setParticipants} />
      </Field>
      <div className="space-y-1.5">
        <span className="block text-[13px] font-medium">Tags</span>
        <TagPicker value={tagIds} onChange={setTagIds} />
      </div>
      {error && <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
