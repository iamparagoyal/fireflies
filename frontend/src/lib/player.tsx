"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

export interface PlayerController {
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number, options?: { play?: boolean }) => void;
  skip: (delta: number) => void;
  setRate: (rate: number) => void;
  mediaRef: React.RefObject<HTMLAudioElement | null>;
}

const clamp = (value: number, max: number) => Math.min(Math.max(0, value), max);

export function usePlayerController(duration: number, hasMedia = false): PlayerController {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const updateTime = useCallback(
    (value: number) => {
      timeRef.current = clamp(value, duration);
      setCurrentTime(timeRef.current);
    },
    [duration],
  );

  useEffect(() => {
    if (!playing || hasMedia) return;
    const tick = (now: number) => {
      if (lastTickRef.current !== null) {
        const next = timeRef.current + ((now - lastTickRef.current) / 1000) * rate;
        if (next >= duration) {
          updateTime(duration);
          setPlaying(false);
          return;
        }
        updateTime(next);
      }
      lastTickRef.current = now;
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      lastTickRef.current = null;
    };
  }, [playing, rate, duration, hasMedia, updateTime]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!hasMedia || !media) return;
    const onTime = () => updateTime(media.currentTime);
    const onEnd = () => setPlaying(false);
    media.addEventListener("timeupdate", onTime);
    media.addEventListener("ended", onEnd);
    return () => {
      media.removeEventListener("timeupdate", onTime);
      media.removeEventListener("ended", onEnd);
    };
  }, [hasMedia, updateTime]);

  const play = useCallback(() => {
    if (timeRef.current >= duration) updateTime(0);
    if (hasMedia) void mediaRef.current?.play().catch(() => setPlaying(false));
    setPlaying(true);
  }, [duration, hasMedia, updateTime]);

  const pause = useCallback(() => {
    if (hasMedia) mediaRef.current?.pause();
    setPlaying(false);
  }, [hasMedia]);

  const seek = useCallback(
    (seconds: number, options?: { play?: boolean }) => {
      updateTime(seconds);
      if (hasMedia && mediaRef.current) mediaRef.current.currentTime = timeRef.current;
      if (options?.play) play();
    },
    [hasMedia, play, updateTime],
  );

  const setRate = useCallback(
    (value: number) => {
      setRateState(value);
      if (hasMedia && mediaRef.current) mediaRef.current.playbackRate = value;
    },
    [hasMedia],
  );

  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [pause, play]);
  const skip = useCallback((delta: number) => seek(timeRef.current + delta), [seek]);

  return useMemo(
    () => ({ currentTime, duration, playing, rate, play, pause, toggle, seek, skip, setRate, mediaRef }),
    [currentTime, duration, playing, rate, play, pause, toggle, seek, skip, setRate],
  );
}

export type PlayerControls = Pick<PlayerController, "play" | "pause" | "toggle" | "seek" | "skip" | "setRate" | "mediaRef">;

const PlayerStateContext = createContext<PlayerController | null>(null);
const PlayerControlsContext = createContext<PlayerControls | null>(null);

export function PlayerProvider({ value, children }: { value: PlayerController; children: React.ReactNode }) {
  const { play, pause, toggle, seek, skip, setRate, mediaRef } = value;
  const controls = useMemo(() => ({ play, pause, toggle, seek, skip, setRate, mediaRef }), [play, pause, toggle, seek, skip, setRate, mediaRef]);
  return (
    <PlayerControlsContext.Provider value={controls}>
      <PlayerStateContext.Provider value={value}>{children}</PlayerStateContext.Provider>
    </PlayerControlsContext.Provider>
  );
}

export function usePlayer(): PlayerController {
  const player = useContext(PlayerStateContext);
  if (!player) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return player;
}

export function usePlayerControls(): PlayerControls {
  const controls = useContext(PlayerControlsContext);
  if (!controls) throw new Error("usePlayerControls must be used inside <PlayerProvider>");
  return controls;
}
