"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { refreshMeetingLists } from "@/lib/queries";

export function useDeleteMeeting(onDeleted?: () => void) {
  const [target, setTarget] = useState<{ id: number; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await api.deleteMeeting(target.id);
      toast.success("Meeting deleted", { description: target.title });
      setTarget(null);
      onDeleted?.();
      await refreshMeetingLists();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete meeting");
    } finally {
      setDeleting(false);
    }
  };

  return { target, setTarget, deleting, confirm };
}
