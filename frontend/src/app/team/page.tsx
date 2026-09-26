import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return <ComingSoon title="Team" description="Invite teammates, share meetings and collaborate on notes with comments and mentions." />;
}
