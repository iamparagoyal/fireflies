import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return <ComingSoon title="Integrations" description="Connect Zoom, Google Meet, Microsoft Teams, your calendar and CRM tools like Salesforce and HubSpot to sync meetings automatically." />;
}
