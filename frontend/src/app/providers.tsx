"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { SWRConfig } from "swr";

import { swrFetcher } from "@/lib/queries";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="bottom-right" richColors closeButton theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <SWRConfig value={{ fetcher: swrFetcher, revalidateOnFocus: false }}>
        {children}
        <ThemedToaster />
      </SWRConfig>
    </ThemeProvider>
  );
}
