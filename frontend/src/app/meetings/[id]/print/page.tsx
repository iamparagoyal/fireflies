import { PrintableMeeting } from "@/components/meeting/PrintableMeeting";

export default async function PrintMeetingPage({ params }: PageProps<"/meetings/[id]/print">) {
  const { id } = await params;
  return <PrintableMeeting meetingId={Number(id)} />;
}
