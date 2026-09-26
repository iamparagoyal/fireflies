import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePlayerController } from "../player";

describe("usePlayerController", () => {
  let now = 0;
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    now = 0;
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  const advance = (ms: number) => {
    now += ms;
    const pending = frames;
    frames = [];
    pending.forEach((cb) => cb(now));
  };

  it("seeks within bounds", () => {
    const { result } = renderHook(() => usePlayerController(120));
    act(() => result.current.seek(50));
    expect(result.current.currentTime).toBe(50);
    act(() => result.current.seek(500));
    expect(result.current.currentTime).toBe(120);
    act(() => result.current.skip(-200));
    expect(result.current.currentTime).toBe(0);
  });

  it("advances time while playing, honoring playback rate", () => {
    const { result } = renderHook(() => usePlayerController(120));
    act(() => result.current.setRate(2));
    act(() => result.current.play());
    expect(result.current.playing).toBe(true);
    act(() => advance(0));
    act(() => advance(1000));
    expect(result.current.currentTime).toBeCloseTo(2);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
  });

  it("stops at the end and restarts from zero on play", () => {
    const { result } = renderHook(() => usePlayerController(1));
    act(() => result.current.play());
    act(() => advance(0));
    act(() => advance(5000));
    expect(result.current.currentTime).toBe(1);
    expect(result.current.playing).toBe(false);
    act(() => result.current.play());
    expect(result.current.currentTime).toBe(0);
  });

  it("seek with play starts playback", () => {
    const { result } = renderHook(() => usePlayerController(60));
    act(() => result.current.seek(10, { play: true }));
    expect(result.current.currentTime).toBe(10);
    expect(result.current.playing).toBe(true);
  });
});
