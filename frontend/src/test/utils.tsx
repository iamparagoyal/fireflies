import { render } from "@testing-library/react";
import { SWRConfig } from "swr";
import { vi } from "vitest";

import { PlayerProvider, usePlayerController } from "@/lib/player";
import { swrFetcher } from "@/lib/queries";

type Handler = (body: unknown, url: URL) => unknown;

export interface MockApi {
  calls: { method: string; path: string; body: unknown }[];
}

export function mockApi(routes: Record<string, Handler | unknown>): MockApi {
  const api: MockApi = { calls: [] };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api/, "");
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ?? null;
    api.calls.push({ method, path: `${path}${url.search}`, body });
    const key = [`${method} ${path}${url.search}`, `${method} ${path}`].find((k) => k in routes);
    if (!key) return new Response(JSON.stringify({ detail: `No mock for ${method} ${path}` }), { status: 404 });
    const route = routes[key];
    const result = typeof route === "function" ? (route as Handler)(body, url) : route;
    if (result instanceof Response) return result;
    if (result === undefined) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  return api;
}

export function renderWithSWR(ui: React.ReactElement) {
  return render(
    <SWRConfig value={{ fetcher: swrFetcher, provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>,
  );
}

function PlayerHarness({ duration, children }: { duration: number; children: React.ReactNode }) {
  const player = usePlayerController(duration);
  return (
    <PlayerProvider value={player}>
      {children}
      <output data-testid="harness-time">{player.currentTime}</output>
      <output data-testid="harness-playing">{String(player.playing)}</output>
    </PlayerProvider>
  );
}

export function renderWithPlayer(ui: React.ReactElement, duration = 30) {
  return renderWithSWR(<PlayerHarness duration={duration}>{ui}</PlayerHarness>);
}
