import type { Metadata } from "next";
import { Suspense } from "react";

import { MeetingLibrary } from "@/components/meetings/MeetingLibrary";

export const metadata: Metadata = { title: "Uploads" };

const UPLOAD_SOURCES = ["upload", "paste", "form"] as const;

export default function UploadsPage() {
  return (
    <Suspense>
      <MeetingLibrary title="Uploads" subtitle="Meetings you added by uploading or pasting a transcript" sources={[...UPLOAD_SOURCES]} />
    </Suspense>
  );
}
