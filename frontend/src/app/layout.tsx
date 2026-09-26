import type { Metadata } from "next";

import { AppShell } from "@/components/layout/AppShell";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Fireflies Notebook", template: "%s · Fireflies Notebook" },
  description: "Meeting transcripts, AI summaries and action items in one workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
