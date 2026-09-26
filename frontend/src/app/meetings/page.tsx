import type { Metadata } from "next";
import { Suspense } from "react";

import { MeetingLibrary } from "@/components/meetings/MeetingLibrary";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return (
    <Suspense>
      <MeetingLibrary title="My Meetings" subtitle="Transcripts, notes and action items from your calls" />
    </Suspense>
  );
}
