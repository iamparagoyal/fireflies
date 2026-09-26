import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Conversation Analytics" };

export default function ConversationAnalyticsPage() {
  return <ComingSoon title="Conversation Analytics" description="Track talk-time, sentiment, topics and trends across all of your meetings." />;
}
