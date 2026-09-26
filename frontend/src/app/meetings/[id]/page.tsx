import { Suspense } from "react";

import { MeetingDetailView } from "@/components/meeting/MeetingDetailView";

export default async function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <MeetingDetailView meetingId={Number(id)} />
    </Suspense>
  );
}
