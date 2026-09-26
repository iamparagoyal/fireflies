import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Live Notetaker" };

export default function LiveNotetakerPage() {
  return <ComingSoon title="Live Notetaker" description="The Fireflies bot that joins Zoom, Google Meet and Teams calls to record and transcribe in real time isn't part of this demo. Upload or paste a transcript instead." />;
}
