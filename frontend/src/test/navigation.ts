import { vi } from "vitest";

export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() };

export const navigationState = { searchParams: new URLSearchParams(), pathname: "/meetings" };

export function setSearchParams(value: string) {
  navigationState.searchParams = new URLSearchParams(value);
}
